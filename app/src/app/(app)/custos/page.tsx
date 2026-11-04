import { Trash2 } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { int, money } from "@/lib/format";
import { proRata } from "@/lib/profit";
import { Card, PageHeader } from "@/components/ui";
import { removeFixedExpense } from "../actions";
import { FixedExpenseForm, ProductCostsForm, RatesForm } from "./forms";

export const metadata = { title: "Custos" };

export default async function Custos() {
  const { ws } = await requireWorkspace();
  // Produtos que já venderam (90 dias) + os que já têm custo cadastrado: o usuário só preenche.
  const products = await query<{ name: string; sales: number; cost: number | null; shipping: number | null }>(
    `with sold as (
       select product_name as name, count(*)::int as sales from orders
       where workspace_id = $1 and product_name is not null and ordered_at > now() - interval '90 days'
       group by product_name)
     select coalesce(s.name, pc.product_name) as name, coalesce(s.sales, 0) as sales,
            pc.cost_cents::int as cost, pc.shipping_cents::int as shipping
     from sold s full join (select * from product_costs where workspace_id = $1) pc on lower(pc.product_name) = lower(s.name)
     order by coalesce(s.sales, 0) desc, 1
     limit 200`,
    [ws.id],
  );
  const fixed = await query<{ id: string; name: string; monthly: number }>(
    "select id, name, monthly_cents::int as monthly from fixed_expenses where workspace_id = $1 order by created_at",
    [ws.id],
  );
  const monthly = fixed.reduce((t, f) => t + f.monthly, 0);

  return (
    <>
      <PageHeader title="Custos" subtitle="Tudo o que sai do faturamento antes de virar lucro. Preencha uma vez; o Resumo e as Campanhas já descontam." />
      <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-6">
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Impostos e taxas</h2>
          <p className="mb-4 text-sm text-muted">Percentuais aplicados em todas as vendas e em todo o gasto com anúncios.</p>
          <RatesForm
            values={{
              saleTax: ws.tax_rate_bps / 100, gatewayFee: ws.gateway_fee_bps / 100, adTax: ws.ad_tax_bps / 100,
              defaultCost: ws.default_product_cost_cents / 100, defaultShipping: ws.default_shipping_cents / 100,
            }}
          />
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold">Custo de cada produto</h2>
          <p className="mb-4 text-sm text-muted">
            Quanto você paga por venda de cada produto (fornecedor) e de frete. Produto sem valor aqui usa o custo padrão de cima.
          </p>
          {products.length === 0 ? (
            <p className="text-sm text-muted">Os produtos aparecem aqui sozinhos quando as primeiras vendas chegarem pelo checkout.</p>
          ) : (
            <ProductCostsForm products={products.map((p) => ({ ...p, sales: Number(p.sales) }))} />
          )}
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold">Despesas fixas do mês</h2>
          <p className="mb-4 text-sm text-muted">
            Ferramentas, plataforma da loja, equipe… O Resumo desconta a parte proporcional aos dias escolhidos
            (ex.: {money(proRata(monthly || 300000, 1))} por dia {monthly ? "com as despesas abaixo" : "para R$ 3.000 por mês"}).
          </p>
          {fixed.length > 0 && (
            <ul className="mb-4 divide-y divide-border rounded-md border border-border">
              {fixed.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="tabular-nums">{money(f.monthly)}/mês</span>
                  <form action={removeFixedExpense}>
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" aria-label={`Remover ${f.name}`} className="rounded-sm p-1 text-muted hover:text-danger">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </form>
                </li>
              ))}
              <li className="flex justify-between px-3 py-2 text-sm font-semibold">
                <span>Total ({int(fixed.length)})</span><span className="tabular-nums">{money(monthly)}/mês</span>
              </li>
            </ul>
          )}
          <FixedExpenseForm />
        </Card>
      </div>
    </>
  );
}
