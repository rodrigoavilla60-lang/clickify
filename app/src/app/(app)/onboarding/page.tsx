import { CheckCircle2, Circle } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { one } from "@/lib/db";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Primeiros passos" };

export default async function Onboarding() {
  const { user, ws } = await requireWorkspace();
  const s = (await one<{ accounts: number; hooks: number; sales: number; attributed: number }>(
    `select (select count(*) from ad_accounts where workspace_id = $1 and enabled)::int as accounts,
            (select count(*) from webhooks where workspace_id = $1)::int as hooks,
            (select count(*) from orders where workspace_id = $1)::int as sales,
            (select count(*) from orders where workspace_id = $1 and ad_external_id is not null)::int as attributed`,
    [ws.id],
  ))!;
  const steps = [
    {
      done: s.accounts > 0, title: "Conecte sua conta do Meta Ads",
      body: "Para puxarmos o gasto e o status de cada campanha. Não acessamos seus criativos.",
      href: "/contas", cta: "Conectar",
    },
    {
      done: s.hooks > 0, title: "Ligue seu checkout",
      body: "Gere uma URL de webhook e cole na sua plataforma de vendas. Cada venda chega aqui na hora.",
      href: "/integracoes", cta: "Criar webhook",
    },
    {
      done: ws.onboarding_utms_copied, title: "Coloque as UTMs nos anúncios",
      body: "Um texto pronto para colar no campo de parâmetros de URL. É ele que liga a venda ao anúncio.",
      href: "/utms", cta: "Ver UTMs",
    },
    {
      done: s.attributed > 0, title: "Receba a primeira venda atribuída",
      body: s.sales > 0 && s.attributed === 0
        ? "Já chegaram vendas, mas sem UTM. Confira se os anúncios estão com os parâmetros."
        : "Quando ela chegar, você vê em qual anúncio ela nasceu.",
      href: "/vendas", cta: "Ver vendas",
    },
  ];
  const done = steps.filter((x) => x.done).length;
  const current = steps.findIndex((x) => !x.done);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        subtitle={done === steps.length ? "Tudo pronto. Seus números já estão chegando." : `${done} de ${steps.length} passos concluídos`}
        actions={done === steps.length && <ButtonLink href="/dashboard">Ir para o resumo</ButtonLink>}
      />
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Progresso">
        <div className="h-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-3">
        {steps.map((st, i) => (
          <li key={st.title}>
            <Card className={`flex flex-col gap-4 sm:flex-row sm:items-center ${i === current ? "border-accent" : ""}`}>
              <span aria-hidden className={st.done ? "text-success" : "text-muted"}>
                {st.done ? <CheckCircle2 className="size-6" /> : <Circle className="size-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">
                  {i + 1}. {st.title}
                  <span className="sr-only">{st.done ? " (feito)" : " (pendente)"}</span>
                </h2>
                <p className="mt-1 text-sm text-muted">{st.body}</p>
              </div>
              <ButtonLink href={st.href} variant={i === current ? "primary" : "secondary"}>
                {st.done ? "Revisar" : st.cta}
              </ButtonLink>
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}
