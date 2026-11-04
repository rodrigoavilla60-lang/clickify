import { RefreshCw, UserSquare2 } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { meta } from "@/lib/meta";
import { dateTime } from "@/lib/format";
import { sameTimeZone } from "@/lib/period";
import { ButtonLink, Card, EmptyState, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { ConnectionsNav, SubmitButton } from "@/components/client";
import { PlatformLogo } from "@/components/platform-logo";
import { syncNow, toggleAdAccount } from "../actions";

export const metadata = { title: "Contas de anúncio" };

// Só o Meta está ligado hoje; as outras aparecem para quem procura e já sabe que vêm aí.
const AD_PLATFORMS = [
  { id: "meta", label: "Meta Ads", ready: true },
  { id: "google", label: "Google Ads", ready: false },
  { id: "tiktok", label: "TikTok Ads", ready: false },
  { id: "kwai", label: "Kwai Ads", ready: false },
  { id: "taboola", label: "Taboola", ready: false },
];

interface Acc {
  id: string; external_id: string; name: string; enabled: boolean; currency: string; timezone: string;
  last_synced_at: string | null; last_sync_error: string | null; token_expires_at: string | null;
}

export default async function Contas({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { ws } = await requireWorkspace();
  const sp = await searchParams;
  const rows = await query<Acc>(
    `select id, external_id, name, enabled, currency, timezone, last_synced_at, last_sync_error, token_expires_at
     from ad_accounts where workspace_id = $1 order by enabled desc, name`,
    [ws.id],
  );
  const mock = meta().mode === "mock";
  const soon = Date.now() + 7 * 864e5;
  const expiring = rows.some((r) => r.enabled && r.token_expires_at && new Date(r.token_expires_at).getTime() < soon);

  return (
    <>
      <ConnectionsNav />
      <PageHeader
        title="Contas de anúncio"
        subtitle="Escolha de quais contas puxamos o gasto e as campanhas."
        actions={
          <>
            {rows.length > 0 && (
              <form action={syncNow}>
                <SubmitButton variant="secondary"><RefreshCw aria-hidden className="size-4" /> Sincronizar agora</SubmitButton>
              </form>
            )}
            <ButtonLink href="/api/meta/connect" prefetch={false}>{rows.length ? "Reconectar Meta" : "Conectar com o Meta"}</ButtonLink>
          </>
        }
      />
      {mock && (
        <Notice tone="warning">
          Modo de demonstração: as contas e o gasto são simulados. Para usar suas contas de verdade, configure
          META_MODE=live com o seu app do Meta (veja o README).
        </Notice>
      )}
      {sp.erro && <Notice tone="danger">Não deu para falar com o Meta: {sp.erro}</Notice>}
      {expiring && <Notice tone="warning">A conexão com o Meta vence em menos de 7 dias. Reconecte para não parar o gasto.</Notice>}

      <section aria-label="Plataformas de anúncio" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {AD_PLATFORMS.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-lg border bg-surface p-3 ${p.ready ? "border-border-input" : "border-border"}`}>
            <PlatformLogo id={p.id} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.label}</span>
              <span className={`block text-xs ${p.ready ? (rows.length ? "text-success" : "text-muted") : "text-muted"}`}>
                {p.ready ? (rows.length ? `${rows.filter((r) => r.enabled).length} ${rows.filter((r) => r.enabled).length === 1 ? "conta ativa" : "contas ativas"}` : "Pronto para conectar")
                  : <span className="mt-0.5 inline-block rounded-sm bg-surface-2 px-1.5 py-0.5 text-muted">Em breve</span>}
              </span>
            </span>
          </div>
        ))}
      </section>

      <Card className="p-0 md:p-0">
        <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold md:px-6"><PlatformLogo id="meta" size={22} /> Contas do Meta</h2>
        {rows.length === 0 ? (
          <EmptyState
            icon={<UserSquare2 className="size-8" />}
            title="Nenhuma conta conectada"
            action={<ButtonLink href="/api/meta/connect" prefetch={false}>Conectar com o Meta</ButtonLink>}
          >
            Você faz login no Meta, autoriza a leitura das campanhas e escolhe as contas aqui.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center md:px-6">
                <PlatformLogo id="meta" size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" title={r.name}>{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.external_id} · {r.currency} · {r.timezone}
                    {r.enabled && (r.last_synced_at ? ` · sincronizada ${dateTime(r.last_synced_at, ws.timezone)}` : " · ainda não sincronizada")}
                  </p>
                  {r.last_sync_error && <p className="mt-1 text-xs text-danger">Erro no último sync: {r.last_sync_error}</p>}
                  {r.enabled && !sameTimeZone(r.timezone, ws.timezone) && (
                    <p className="mt-1 text-xs text-warning">Fuso da conta diferente do seu ({ws.timezone}): o gasto por dia segue o fuso da conta.</p>
                  )}
                </div>
                <StatusBadge status={r.enabled ? "ACTIVE" : "PAUSED"} />
                <form action={toggleAdAccount}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="enabled" value={String(!r.enabled)} />
                  <SubmitButton variant={r.enabled ? "secondary" : "primary"}>{r.enabled ? "Desativar" : "Ativar"}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
