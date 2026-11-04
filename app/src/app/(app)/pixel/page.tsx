import { Radar } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { meta } from "@/lib/meta";
import { dateTime, money } from "@/lib/format";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { ConnectionsNav, SubmitButton } from "@/components/client";
import { removePixel, retryPixel, togglePixel } from "../actions";
import { NewPixelForm, TestPixelButton } from "./forms";

export const metadata = { title: "Pixel" };

const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Enviado", cls: "text-success" },
  failed: { label: "Falhou", cls: "text-danger" },
  sending: { label: "Enviando", cls: "text-muted" },
  skipped: { label: "Não enviado", cls: "text-warning" },
};

export default async function Pixel() {
  const { ws } = await requireWorkspace();
  const [pixels, hooks, events] = await Promise.all([
    query<{ id: string; name: string; pixel_id: string; test_event_code: string | null; enabled: boolean;
      last_event_at: string | null; last_error: string | null; hook: string | null }>(
      `select p.id, p.name, p.pixel_id, p.test_event_code, p.enabled, p.last_event_at, p.last_error, w.name as hook
       from pixels p left join webhooks w on w.id = p.webhook_id where p.workspace_id = $1 order by p.created_at`,
      [ws.id],
    ),
    query<{ id: string; name: string }>("select id, name from webhooks where workspace_id = $1 and platform <> 'capture' order by created_at", [ws.id]),
    query<{ id: string; status: string; event_name: string; fields: string[]; response: string | null; created_at: string;
      pixel: string; external_id: string | null; amount_cents: string | null; attempts: number }>(
      `select e.id, e.status, e.event_name, e.fields, e.response, e.created_at, e.attempts, p.name as pixel,
              o.external_id, o.amount_cents
       from capi_events e join pixels p on p.id = e.pixel_id left join orders o on o.id = e.order_id
       where e.workspace_id = $1 order by e.created_at desc limit 30`,
      [ws.id],
    ),
  ]);
  const failed = events.filter((e) => e.status === "failed").length;

  return (
    <>
      <ConnectionsNav />
      <PageHeader title="Pixel pelo servidor" subtitle="Cada venda aprovada vai direto do Clickify para o Meta, sem depender do navegador do cliente." />
      {meta().mode === "mock" && (
        <Notice tone="warning">Modo de teste: nada é enviado de verdade ao Meta. Os envios aparecem abaixo marcados como simulados.</Notice>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-0 md:p-0">
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold md:px-6">Pixels ligados</h2>
            {pixels.length === 0 ? (
              <EmptyState icon={<Radar className="size-8" />} title="Nenhum pixel ligado ainda">
                Cadastre o pixel ao lado. Com ele, o Meta recebe as vendas mesmo quando o navegador bloqueia o pixel comum
                (iPhone, bloqueador de anúncios, pagamento por Pix ou boleto concluído depois).
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {pixels.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold" title={p.name}>{p.name} {!p.enabled && <span className="text-xs font-normal text-warning">(desligado)</span>}</p>
                      <p className="text-xs text-muted">
                        ID {p.pixel_id} · {p.hook ? `vendas de ${p.hook}` : "vendas de todos os checkouts"}
                        {p.test_event_code && " · com código de teste"}
                      </p>
                      <p className="text-xs text-muted">{p.last_event_at ? `último envio ${dateTime(p.last_event_at, ws.timezone)}` : "nenhum envio ainda"}</p>
                      {p.last_error && <p className="mt-1 text-xs text-danger">Último erro: {p.last_error}</p>}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <TestPixelButton id={p.id} hasCode={!!p.test_event_code} />
                      <form action={togglePixel}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="enabled" value={String(!p.enabled)} />
                        <SubmitButton variant="secondary">{p.enabled ? "Desligar" : "Ligar"}</SubmitButton>
                      </form>
                      <form action={removePixel}>
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton variant="danger">Remover</SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-0 md:p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
              <h2 className="text-sm font-semibold">Últimos envios</h2>
              {failed > 0 && <form action={retryPixel}><SubmitButton variant="secondary">Tentar de novo as falhas</SubmitButton></form>}
            </div>
            {events.length === 0 ? (
              <EmptyState title="Nenhum envio ainda">Assim que uma venda for aprovada, o envio aparece aqui com o que foi junto.</EmptyState>
            ) : (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela dos últimos envios">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Quando</th>
                      <th scope="col" className="px-4 py-3 font-medium">Venda</th>
                      <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                      <th scope="col" className="px-4 py-3 font-medium">O que foi junto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {events.map((e) => {
                      const s = STATUS[e.status] ?? STATUS.sending;
                      return (
                        <tr key={e.id} className="align-top">
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dateTime(e.created_at, ws.timezone)}</td>
                          <td className="max-w-[200px] px-4 py-3">
                            <p className="truncate" title={e.external_id ?? e.event_name}>{e.external_id ?? "Evento de teste"}</p>
                            <p className="truncate text-xs text-muted">{e.amount_cents ? money(Number(e.amount_cents)) : "R$ 1,00"} · {e.pixel}</p>
                          </td>
                          <td className="max-w-[260px] px-4 py-3">
                            <p className={`font-medium ${s.cls}`}>{s.label}{e.status === "failed" && e.attempts > 1 ? ` (${e.attempts} tentativas)` : ""}</p>
                            {e.status !== "sent" && e.response && <p className="text-xs text-muted">{e.response}</p>}
                            {e.status === "sent" && e.response?.includes("simulado") && <p className="text-xs text-muted">simulado</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">{e.fields.length ? e.fields.join(", ") : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Ligar um pixel</h2>
          <NewPixelForm hooks={hooks} />
          <details className="mt-6 text-sm text-muted">
            <summary className="cursor-pointer">Como funciona e o que é enviado?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Quando o checkout avisa que a venda foi aprovada, o Clickify manda um evento &quot;Compra&quot; com o valor e o número do pedido.</li>
              <li>Para o Meta reconhecer o comprador vão, quando o checkout manda: e-mail, telefone, nome, cidade, CEP e CPF, todos
                criptografados (hash), mais IP e navegador. O Clickify nunca guarda esses dados em claro e apaga até o hash depois de 8 dias.</li>
              <li>O número do pedido vai como identificador do evento. Se o checkout também dispara o pixel do navegador com esse número,
                o Meta junta os dois e conta uma compra só.</li>
              <li>Falhou? O Clickify tenta de novo uma vez por dia, até 5 vezes. Compras com mais de 7 dias o Meta não aceita.</li>
            </ul>
          </details>
        </Card>
      </div>
    </>
  );
}
