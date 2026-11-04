import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTracking, levelOf, type TrackingRow } from "../src/lib/tracking.ts";

const row = (o: Partial<TrackingRow>): TrackingRow => ({ key: "Loja", platform: "generic", total: 0, ad: 0, utmOnly: 0, none: 0, ...o });

test("taxa = com origem ÷ total; anúncio separado", () => {
  const t = computeTracking([row({ total: 10, ad: 7, utmOnly: 2, none: 1 })]);
  assert.equal(t.rate, 0.9);
  assert.equal(t.adRate, 0.7);
  assert.equal(t.level, "good");
  assert.equal(t.tip, null);
});

test("níveis e poucas vendas", () => {
  assert.equal(levelOf(0.95, 20), "good");
  assert.equal(levelOf(0.8, 20), "warn");
  assert.equal(levelOf(0.5, 20), "bad");
  assert.equal(levelOf(0.2, 4), "few");
  assert.equal(levelOf(null, 0), "few");
  assert.equal(computeTracking([]).rate, null);
});

test("conselho aponta o checkout que mais perde e o motivo", () => {
  const t = computeTracking([
    row({ key: "Shopify", platform: "shopify", total: 10, ad: 10 }),
    row({ key: "Kiwify", platform: "kiwify", total: 10, ad: 2, none: 8 }),
  ]);
  assert.equal(t.level, "bad"); // 12 de 20 = 60%
  assert.match(t.tip!, /vendas de Kiwify chegam sem UTM/);
  const h = computeTracking([row({ key: "Hotmart", platform: "hotmart", total: 10, none: 10 })]);
  assert.match(h.tip!, /parâmetro sck/);
  const u = computeTracking([row({ key: "Loja", total: 10, ad: 1, utmOnly: 9 })]);
  assert.equal(u.level, "good"); // a UTM chega: rastreio ok, mas falta o ID do anúncio
  assert.match(u.tip!, /sem o ID do anúncio/);
  const u2 = computeTracking([row({ key: "Loja", total: 10, ad: 1, utmOnly: 5, none: 4 })]);
  assert.match(u2.tip!, /chegam sem UTM/);
});
