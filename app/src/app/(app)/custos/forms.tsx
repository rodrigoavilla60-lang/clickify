"use client";

import { useActionState } from "react";
import { FieldError, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { addFixedExpense, saveProductCosts, updateCostRates, type CostState } from "../actions";

const br = (n: number) => (n ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "");
const brMoney = (cents: number | null) => (cents ? (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");

function Status({ state }: { state: CostState }) {
  return (
    <>
      <FieldError id="cost-err">{state.error}</FieldError>
      {state.ok && <p role="status" className="text-sm text-success">{state.ok}</p>}
    </>
  );
}

export function RatesForm({ values }: {
  values: { saleTax: number; gatewayFee: number; adTax: number; defaultCost: number; defaultShipping: number };
}) {
  const [state, action] = useActionState<CostState, FormData>(updateCostRates, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="saleTax">Imposto sobre a venda (%)</Label>
          <Input id="saleTax" name="saleTax" inputMode="decimal" defaultValue={br(values.saleTax)} placeholder="0" aria-describedby="saleTax-h" />
          <p id="saleTax-h" className="mt-1 text-xs text-muted">Ex.: 6 no Simples Nacional, anexo I.</p>
        </div>
        <div>
          <Label htmlFor="gatewayFee">Taxa do gateway (%)</Label>
          <Input id="gatewayFee" name="gatewayFee" inputMode="decimal" defaultValue={br(values.gatewayFee)} placeholder="0" aria-describedby="gatewayFee-h" />
          <p id="gatewayFee-h" className="mt-1 text-xs text-muted">O que o checkout cobra por venda.</p>
        </div>
        <div>
          <Label htmlFor="adTax">Imposto sobre o anúncio (%)</Label>
          <Input id="adTax" name="adTax" inputMode="decimal" defaultValue={br(values.adTax)} placeholder="0" aria-describedby="adTax-h" />
          <p id="adTax-h" className="mt-1 text-xs text-muted">O Meta cobra impostos em cima do gasto. Confira o percentual na sua fatura.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="defaultCost">Custo padrão por venda (R$)</Label>
          <Input id="defaultCost" name="defaultCost" inputMode="decimal" defaultValue={br(values.defaultCost)} placeholder="0,00" aria-describedby="defaultCost-h" />
          <p id="defaultCost-h" className="mt-1 text-xs text-muted">Usado para produtos sem custo próprio abaixo.</p>
        </div>
        <div>
          <Label htmlFor="defaultShipping">Frete padrão por venda (R$)</Label>
          <Input id="defaultShipping" name="defaultShipping" inputMode="decimal" defaultValue={br(values.defaultShipping)} placeholder="0,00" />
        </div>
      </div>
      <Status state={state} />
      <SubmitButton>Salvar impostos e padrões</SubmitButton>
    </form>
  );
}

export function ProductCostsForm({ products }: {
  products: { name: string; sales: number; cost: number | null; shipping: number | null }[];
}) {
  const [state, action] = useActionState<CostState, FormData>(saveProductCosts, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th scope="col" className="pb-2 font-medium">Produto</th>
              <th scope="col" className="pb-2 text-right font-medium">Vendas (90 dias)</th>
              <th scope="col" className="pb-2 pl-3 font-medium">Custo (R$)</th>
              <th scope="col" className="pb-2 pl-3 font-medium">Frete (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p, i) => (
              <tr key={p.name}>
                <th scope="row" className="max-w-[260px] py-2 pr-3 text-left font-normal">
                  <span className="block truncate" title={p.name}>{p.name}</span>
                  <input type="hidden" name="product" value={p.name} />
                </th>
                <td className="py-2 text-right tabular-nums text-muted">{p.sales}</td>
                <td className="py-2 pl-3">
                  <Input name="cost" inputMode="decimal" defaultValue={brMoney(p.cost)} placeholder="padrão"
                    aria-label={`Custo de ${p.name}`} className="h-9 w-28" id={`cost-${i}`} />
                </td>
                <td className="py-2 pl-3">
                  <Input name="shipping" inputMode="decimal" defaultValue={brMoney(p.shipping)} placeholder="padrão"
                    aria-label={`Frete de ${p.name}`} className="h-9 w-28" id={`ship-${i}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Status state={state} />
      <SubmitButton>Salvar custos dos produtos</SubmitButton>
    </form>
  );
}

export function FixedExpenseForm() {
  const [state, action] = useActionState<CostState, FormData>(addFixedExpense, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <div>
          <Label htmlFor="fx-name">Despesa</Label>
          <Input id="fx-name" name="name" placeholder="Ex.: Shopify, equipe, ferramentas" maxLength={60} />
        </div>
        <div>
          <Label htmlFor="fx-monthly">Valor por mês (R$)</Label>
          <Input id="fx-monthly" name="monthly" inputMode="decimal" placeholder="0,00" />
        </div>
        <SubmitButton variant="secondary">Adicionar</SubmitButton>
      </div>
      <Status state={state} />
    </form>
  );
}
