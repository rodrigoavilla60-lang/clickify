import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProfit, daysBetween, proRata } from "../src/lib/profit.ts";

const S = { saleTaxBps: 600, gatewayFeeBps: 499, adTaxBps: 1215 };

test("lucro desconta gasto, impostos, taxa, produto e fixas", () => {
  const p = computeProfit(S, { revenue: 100000, spend: 30000, sales: 10, productCost: 20000, fixedCost: 5000 });
  const by = Object.fromEntries(p.lines.map((l) => [l.key, l.amount]));
  assert.equal(by.adTax, 3645); // 12,15% de 300,00
  assert.equal(by.saleTax, 6000);
  assert.equal(by.gatewayFee, 4990);
  // 1000 - 300 - 36,45 - 60 - 49,90 - 200 - 50 = 303,65
  assert.equal(p.profit, 30365);
  assert.equal(p.costsTotal, 3645 + 6000 + 4990 + 20000 + 5000);
  assert.equal(p.cpa, 3000);
  assert.ok(Math.abs((p.margin ?? 0) - 0.30365) < 1e-9);
});

test("custos zerados somem da conta, o gasto fica", () => {
  const p = computeProfit({ saleTaxBps: 0, gatewayFeeBps: 0, adTaxBps: 0 }, { revenue: 5000, spend: 0, sales: 1 });
  assert.deepEqual(p.lines.map((l) => l.key), ["spend"]);
  assert.equal(p.profit, 5000);
  assert.equal(p.roas, null);
  assert.equal(p.roi, null);
});

test("explicação da conta em português", () => {
  const p = computeProfit(S, { revenue: 1000, spend: 1000, sales: 1 });
  assert.equal(p.lines.find((l) => l.key === "adTax")?.how, "12,15% sobre o gasto com anúncios.");
});

test("despesa fixa proporcional aos dias", () => {
  assert.equal(daysBetween("2026-11-01", "2026-11-01"), 1);
  assert.equal(daysBetween("2026-10-03", "2026-11-01"), 30);
  assert.equal(proRata(365000, 1), 12000); // R$ 3.650/mês = R$ 120/dia
  assert.equal(proRata(300000, 30), 295890);
});
