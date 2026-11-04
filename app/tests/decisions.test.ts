import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, DEFAULT_RULES, noSaleThreshold, trackingAlert, type Candidate } from "../src/lib/decisions.ts";

const c = (o: Partial<Candidate>): Candidate => ({
  id: "1", name: "X", level: "ad", active: true, budget: null, spend: 0, revenue: 0, sales: 0, profit: 0, ...o,
});

test("pausa quem gastou acima do limite sem venda", () => {
  const d = decide([c({ id: "a", name: "Criativo 3", spend: 9000 })], null);
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, "pause");
  assert.match(d[0].reason, /Gastou R\$\s90,00 nos últimos 3 dias e não trouxe nenhuma venda/);
});

test("não alarma abaixo do limite nem em pausado", () => {
  assert.equal(decide([c({ spend: 4000 })], null).length, 0);
  assert.equal(decide([c({ spend: 90000, active: false })], null).length, 0);
});

test("limite acompanha o lucro que uma venda deixa", () => {
  assert.equal(noSaleThreshold(null), DEFAULT_RULES.minSpendNoSale);
  assert.equal(noSaleThreshold(2000), DEFAULT_RULES.minSpendNoSale); // nunca abaixo do mínimo
  assert.equal(noSaleThreshold(15000), 15000); // venda deixa R$ 150 -> pausa depois de R$ 150 sem venda
  assert.equal(decide([c({ spend: 12000 })], 15000).length, 0);
  assert.equal(decide([c({ spend: 16000 })], 15000).length, 1);
});

test("pausa quem vende com prejuízo", () => {
  const d = decide([c({ spend: 20000, sales: 1, revenue: 15000, profit: -8000 })], null);
  assert.equal(d[0].kind, "pause");
  assert.match(d[0].reason, /prejuízo de R\$\s80,00/);
});

test("escala quem dá lucro com margem, subindo 20% arredondado", () => {
  const d = decide([c({ level: "adset", budget: 5000, spend: 15000, sales: 4, revenue: 60000, profit: 20000 })], null);
  assert.equal(d[0].kind, "scale");
  assert.equal(d[0].newBudget, 6000);
  assert.match(d[0].reason, /de R\$\s50,00 para R\$\s60,00 por dia/);
});

test("não escala sem orçamento no nível, com poucas vendas ou margem baixa", () => {
  assert.equal(decide([c({ budget: null, sales: 5, revenue: 60000, profit: 20000, spend: 1000 })], null).length, 0);
  assert.equal(decide([c({ budget: 5000, sales: 1, revenue: 60000, profit: 20000, spend: 1000 })], null).length, 0);
  assert.equal(decide([c({ budget: 5000, sales: 5, revenue: 60000, profit: 6000, spend: 1000 })], null).length, 0);
});

test("pausas antes de escalas, maior impacto primeiro, no máximo 8", () => {
  const many = [
    c({ id: "s", budget: 5000, sales: 5, revenue: 60000, profit: 30000, spend: 1000 }),
    c({ id: "p1", spend: 6000 }),
    c({ id: "p2", spend: 30000 }),
    ...Array.from({ length: 10 }, (_, i) => c({ id: `x${i}`, spend: 7000 + i })),
  ];
  const d = decide(many, null);
  assert.equal(d.length, 8);
  assert.equal(d[0].id, "p2");
  assert.ok(d.every((x) => x.kind === "pause"));
});

test("alerta de rastreio quando há gasto e nenhum pedido", () => {
  assert.equal(trackingAlert(20000, 0)?.kind, "check");
  assert.equal(trackingAlert(20000, 1), null);
  assert.equal(trackingAlert(5000, 0), null);
});
