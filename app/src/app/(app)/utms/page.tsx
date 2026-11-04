import { requireWorkspace } from "@/lib/auth";
import { UTM_TEMPLATE } from "@/lib/normalize";
import { Card, PageHeader } from "@/components/ui";
import { UtmCopy } from "./utm-copy";
import { ConnectionsNav, CopyField } from "@/components/client";
import { HOTMART_PARAMS } from "@/lib/platforms";

export const metadata = { title: "UTMs" };

export default async function Utms() {
  await requireWorkspace();
  return (
    <>
      <ConnectionsNav />
      <PageHeader title="UTMs" subtitle="O texto que liga cada venda ao anúncio que a trouxe." />
      <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold">Parâmetros de URL</h2>
          <UtmCopy value={UTM_TEMPLATE} />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>No Gerenciador de Anúncios, abra o <b className="text-text">anúncio</b> (não a campanha).</li>
            <li>Em <b className="text-text">Rastreamento</b>, cole o texto em <b className="text-text">Parâmetros de URL</b>.</li>
            <li>Dá para selecionar vários anúncios e editar todos de uma vez.</li>
          </ol>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Vende pela Hotmart?</h2>
          <p className="text-sm text-muted">
            A Hotmart não repassa UTMs para o webhook, só os campos src e sck. Nos anúncios que levam para a Hotmart,
            use este texto no lugar do de cima: ele manda os IDs da campanha, do conjunto e do anúncio no sck.
          </p>
          <CopyField value={HOTMART_PARAMS} label="Parâmetros de URL para anúncios que vendem pela Hotmart" />
        </Card>
        <Card className="space-y-2 text-sm text-muted">
          <h2 className="text-sm font-semibold text-text">Como funciona</h2>
          <p>
            O Meta troca cada <code className="font-mono text-xs text-text">{"{{...}}"}</code> pelo nome e pelo ID reais
            na hora do clique. A UTM viaja até o checkout e volta para nós junto com a venda.
          </p>
          <p>
            Usamos o <b className="text-text">ID</b> (o número depois da barra) para achar o anúncio. Por isso,
            renomear campanhas não quebra nada.
          </p>
          <p>
            Se o seu checkout perde as UTMs no caminho (redirecionamentos, páginas intermediárias), as vendas aparecem
            como <b className="text-text">não atribuídas</b> em Vendas.
          </p>
        </Card>
      </div>
    </>
  );
}
