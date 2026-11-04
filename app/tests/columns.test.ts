import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMNS, DEFAULT_COLUMNS, columnByKey, parseColumns } from "../src/lib/columns.ts";

const B = { spend: 10000, revenue: 30000, sales: 3, profit: 12000, productCost: 5000, impressions: 20000, linkClicks: 400, pageViews: 300, addToCart: 40, checkout: 12 };
const v = (k: string) => columnByKey(k)!.value(B);

test("contas das colunas derivadas", () => {
  assert.equal(v("roas"), 3);
  assert.ok(Math.abs((v("cpa") ?? 0) - 3333.333) < 0.01);
  assert.equal(v("cpm"), 500); // R$ 100 / 20 mil impressões = R$ 5,00 por mil
  assert.equal(v("ctr"), 0.02);
  assert.equal(v("cpc"), 25);
  assert.equal(v("conversion"), 0.0075);
  assert.equal(v("margin"), 0.4);
});

test("divisão por zero vira vazio, não infinito", () => {
  const zero = { ...B, sales: 0, impressions: 0, linkClicks: 0, spend: 0, revenue: 0 };
  for (const k of ["roas", "cpa", "cpm", "ctr", "cpc", "conversion", "margin"])
    assert.equal(columnByKey(k)!.value(zero), null, k);
});

test("parseColumns ignora chave desconhecida e cai no padrão", () => {
  assert.deepEqual(parseColumns("spend,xss<script>,ctr"), ["spend", "ctr"]);
  assert.deepEqual(parseColumns(""), DEFAULT_COLUMNS);
  assert.deepEqual(parseColumns(undefined), DEFAULT_COLUMNS);
});

test("toda coluna tem explicação em português", () => {
  for (const c of COLUMNS) assert.ok(c.explain.length > 10 && /[a-zá-ú]/.test(c.explain), c.key);
});
