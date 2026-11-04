import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Card, Notice, PageHeader } from "@/components/ui";
import { PlatformLogo } from "@/components/platform-logo";
import { CopyField, SubmitButton } from "@/components/client";
import { deleteWebhook, sendTestOrder } from "../../actions";
import { HOTMART_PARAMS, isPlatform, PLATFORMS } from "@/lib/platforms";

export const metadata = { title: "Webhook" };

const GENERIC_EXAMPLE = `{
  "id": "PED-1042",
  "status": "approved",
  "amount": 197.90,
  "currency": "BRL",
  "product": "Kit 3 peças",
  "email": "cliente@exemplo.com",
  "created_at": "2026-11-01T14:03:00-03:00",
  "utm_source": "FB",
  "utm_campaign": "Campanha X|23850000000000",
  "utm_medium": "Público Y|23850000000001",
  "utm_content": "Criativo Z|23850000000002"
}`;

export default async function WebhookPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ teste?: string }>;
}) {
  const { ws } = await requireWorkspace();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const hook = await one<{ id: string; name: string; platform: string; token: string; signing_secret: string | null; last_event_at: string | null }>(
    "select id, name, platform, token, signing_secret, last_event_at from webhooks where id = $1 and workspace_id = $2",
    [id, ws.id],
  );
  if (!hook) notFound();
  const platform = isPlatform(hook.platform) ? hook.platform : "generic";
  const info = PLATFORMS[platform];
  const events = await query<{ id: string; received_at: string; processed_at: string | null; error: string | null; payload: unknown }>(
    `select id, received_at, processed_at, error, payload from webhook_events
     where webhook_id = $1 order by received_at desc limit 10`,
    [hook.id],
  );
  // O conteúdo cru só aparece onde ajuda: no modo capturar e nos eventos que deram erro.
  const showPayload = (e: { error: string | null }) => platform === "capture" || !!e.error;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${origin}/api/webhooks/${hook.token}`;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/integracoes" className="text-muted hover:text-text">← Checkouts</Link></p>
      <div className="mb-3"><PlatformLogo id={hook.platform} size={44} /></div>
      <PageHeader title={hook.name} subtitle={`${info.label}${info.beta ? " · beta" : ""}`} />
      {sp.teste && <Notice tone="success">Venda de teste registrada. Veja em <Link className="underline" href="/vendas">Vendas</Link>.</Notice>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold">1. Copie a URL</h2>
          <CopyField value={url} label="URL do webhook" />
          <p className="text-xs text-muted">Quem tiver essa URL consegue mandar vendas para a sua conta. Não publique.</p>
          <h2 className="pt-2 text-sm font-semibold">2. Cole no seu checkout</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            {info.steps.map((s) => <li key={s}>{s}</li>)}
            {info.secret && !hook.signing_secret && (
              <li className="text-warning">Sem {info.secret.label.toLowerCase()}: aceitamos qualquer evento que chegue nessa URL.</li>
            )}
          </ol>
          {info.beta && (
            <p className="text-xs text-muted">Os nomes dos menus da {info.label} mudam com frequência; se não achar, procure por &quot;Webhook&quot; nas configurações.</p>
          )}
          {hook.platform === "hotmart" && (
            <CopyField value={HOTMART_PARAMS} label="Parâmetros de URL para anúncios que vendem pela Hotmart" />
          )}
          {hook.platform === "generic" && (
            <>
              <p className="text-sm text-muted">Status aceitos: approved, pending, refused, refunded, chargeback (ou paid, pago, cancelado…).</p>
              <pre tabIndex={0} aria-label="Exemplo de JSON" className="overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-xs">{GENERIC_EXAMPLE}</pre>
            </>
          )}
          <h2 className="pt-2 text-sm font-semibold">3. Teste</h2>
          <form action={sendTestOrder}>
            <input type="hidden" name="id" value={hook.id} />
            <SubmitButton variant="secondary">Simular uma venda</SubmitButton>
          </form>
          <p className="text-xs text-muted">Cria uma venda aprovada com as UTMs de um anúncio ativo seu, para você ver a atribuição funcionando.</p>
        </Card>

        <Card className="p-0 md:p-0">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold md:px-6">Últimos eventos recebidos</h2>
          {events.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted md:px-6">Nada chegou ainda. Depois de configurar, faça um pedido de teste no checkout.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => (
                <li key={e.id} className="px-4 py-2.5 md:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="tabular-nums text-muted">{dateTime(e.received_at, ws.timezone)}</span>
                    {e.error ? <span className="truncate text-danger" title={e.error}>Erro: {e.error}</span>
                      : !e.processed_at ? <span className="text-warning">Na fila</span>
                      : platform === "capture" ? <span className="text-success">Capturado</span>
                      : <span className="text-success">Processado</span>}
                  </div>
                  {showPayload(e) && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted hover:text-text">Ver o que chegou (tem dados do cliente)</summary>
                      <pre tabIndex={0} aria-label="Conteúdo do evento" className="mt-2 max-h-80 overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-xs">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          {hook.last_event_at && <p className="border-t border-border px-4 py-2 text-xs text-muted md:px-6">Último evento: {dateTime(hook.last_event_at, ws.timezone)}</p>}
        </Card>
      </div>

      <form action={deleteWebhook} className="mt-8">
        <input type="hidden" name="id" value={hook.id} />
        <SubmitButton variant="danger">Excluir webhook</SubmitButton>
        <p className="mt-2 text-xs text-muted">As vendas já recebidas continuam no relatório.</p>
      </form>
    </>
  );
}
