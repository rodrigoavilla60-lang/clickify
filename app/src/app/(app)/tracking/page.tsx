import { Globe, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import { requireWorkspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { ConnectionsNav, CopyField, SubmitButton } from "@/components/client";
import { deleteTrackingSite } from "../actions";
import { NewSiteForm } from "./forms";

export const metadata = { title: "Tracking" };

interface SiteRow {
  id: string;
  name: string;
  public_key: string;
  domain: string | null;
  created_at: string;
  visitors: number;
  clicks: number;
  last_click_at: string | null;
}

export default async function Tracking() {
  const { ws } = await requireWorkspace();
  const sites = await query<SiteRow>(
    `select s.id, s.name, s.public_key, s.domain, s.created_at,
       (select count(*) from tracking_visitors v where v.site_id = s.id)::int as visitors,
       (select count(*) from tracking_clicks c where c.site_id = s.id)::int as clicks,
       (select max(c.created_at) from tracking_clicks c where c.site_id = s.id) as last_click_at
     from tracking_sites s where s.workspace_id = $1 order by s.created_at`,
    [ws.id],
  );
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "SEU-DOMINIO";
  const origin = `${proto}://${host}`;

  return (
    <>
      <ConnectionsNav />
      <PageHeader
        title="Tracking first-party"
        subtitle="O script t.js captura UTMs e click IDs no navegador do visitante e guarda por 30 dias. Quando a venda chega, o Clickify liga o pedido ao clique — mesmo que o checkout não repasse as UTMs."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-0 md:p-0">
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold md:px-6">Sites monitorados</h2>
            {sites.length === 0 ? (
              <EmptyState icon={<Globe className="size-8" />} title="Nenhum site ainda">
                Crie o primeiro site ao lado e cole o snippet no <code>&lt;head&gt;</code> das páginas.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {sites.map((s) => {
                  const snippet = `<script src="${origin}/t.js" data-site="${s.public_key}" async></script>`;
                  const cnameSnippet = `<script src="https://${s.domain ?? "t.seudominio.com"}/t.js" data-site="${s.public_key}" async></script>`;
                  return (
                    <li key={s.id} className="space-y-3 px-4 py-4 md:px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted">
                            {s.visitors} visitantes · {s.clicks} cliques com atribuição
                            {s.last_click_at ? ` · último clique ${dateTime(s.last_click_at)}` : " · sem cliques ainda"}
                          </p>
                        </div>
                        <form action={deleteTrackingSite}>
                          <input type="hidden" name="id" value={s.id} />
                          <SubmitButton variant="danger" className="px-2 py-1" >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Excluir {s.name}</span>
                          </SubmitButton>
                        </form>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted">Snippet (cole no &lt;head&gt;)</p>
                        <CopyField value={snippet} label="Copiar snippet" />
                      </div>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-text">
                          Via CNAME (recomendado) {s.domain ? `— configurado: ${s.domain}` : "— como configurar"}
                        </summary>
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-muted">
                            Crie um registro CNAME <code>{s.domain ?? "t.seudominio.com"}</code> apontando para{" "}
                            <code>{host}</code>. O cookie vira first-party de verdade: imune a bloqueadores de anúncio.
                          </p>
                          <CopyField value={cnameSnippet} label="Copiar snippet com CNAME" />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Notice tone="info">
            O script injeta <code>ck_vid</code> + UTMs como campos ocultos nos formulários: no Shopify, eles chegam
            como <code>note_attributes</code> e o Clickify liga a venda ao clique automaticamente. Sem o script,
            a atribuição continua funcionando com as UTMs que o checkout repassar no webhook.
          </Notice>
        </div>
        <div>
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Novo site</h2>
            <NewSiteForm />
          </Card>
        </div>
      </div>
    </>
  );
}
