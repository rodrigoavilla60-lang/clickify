// Roda com: node --test tests/  (o Node 24 entende TypeScript direto)
import { test } from "node:test";
import assert from "node:assert/strict";
import { attribute, canTransition, idFromUtm, normalizeGeneric, normalizeShopify } from "../src/lib/normalize.ts";

test("idFromUtm pega o ID depois do último |, mesmo com | no nome", () => {
  assert.equal(idFromUtm("Mulheres 30-55 | Aberto|2385010100000"), "2385010100000");
  assert.equal(idFromUtm("Campanha%20X%7C2385010000000"), "2385010000000");
  assert.equal(idFromUtm("2385010000000"), "2385010000000");
});

test("idFromUtm recusa o que não é ID do Meta", () => {
  assert.equal(idFromUtm("{{campaign.id}}"), null);
  assert.equal(idFromUtm("black-friday"), null);
  assert.equal(idFromUtm("nome|12"), null);
  assert.equal(idFromUtm(""), null);
  assert.equal(idFromUtm(null), null);
});

test("attribute mapeia campaign/medium/content para campanha/conjunto/anúncio", () => {
  const a = attribute({
    utm_source: "FB", utm_term: null,
    utm_campaign: "C|111111111", utm_medium: "S|222222222", utm_content: "A|333333333",
  });
  assert.deepEqual(a, { campaign: "111111111", adset: "222222222", ad: "333333333" });
});

test("normalizeGeneric aceita reais, status em português e UTMs em vários lugares", () => {
  const o = normalizeGeneric({ id: 42, status: "pago", amount: "197,90", utms: { utm_campaign: "X|111111111" } });
  assert.equal(o.externalId, "42");
  assert.equal(o.status, "approved");
  assert.equal(o.amountCents, 19790);
  assert.equal(o.utm_campaign, "X|111111111");
  assert.ok(o.approvedAt instanceof Date);

  const fromUrl = normalizeGeneric({ id: "a", status: "pending", amount_cents: 500, url: "https://l.com/?utm_content=Ad%7C333333333" });
  assert.equal(fromUrl.utm_content, "Ad|333333333");
  assert.equal(fromUrl.amountCents, 500);
  assert.equal(fromUrl.approvedAt, null);
});

test("normalizeGeneric recusa payload sem id ou com status desconhecido", () => {
  assert.throws(() => normalizeGeneric({ status: "approved" }), /id ausente/);
  assert.throws(() => normalizeGeneric({ id: 1, status: "talvez" }), /status desconhecido/);
});

test("normalizeShopify lê status financeiro, UTMs do landing_site e note_attributes", () => {
  const o = normalizeShopify("orders/paid", {
    id: 9001, financial_status: "paid", total_price: "149.90", currency: "BRL",
    landing_site: "/products/x?utm_source=FB&utm_campaign=C%7C111111111",
    note_attributes: [{ name: "utm_content", value: "A|333333333" }],
    line_items: [{ title: "Sutiã" }],
  });
  assert.ok(!("refundOf" in o));
  if ("refundOf" in o) return;
  assert.equal(o.status, "approved");
  assert.equal(o.amountCents, 14990);
  assert.equal(o.utm_campaign, "C|111111111");
  assert.equal(o.utm_content, "A|333333333");
  assert.equal(o.productName, "Sutiã");

  const cancelled = normalizeShopify("orders/updated", { id: 1, financial_status: "pending", cancelled_at: "2026-11-01" });
  assert.equal("refundOf" in cancelled ? "" : cancelled.status, "refused");
  assert.deepEqual(normalizeShopify("refunds/create", { order_id: 9001 }), { refundOf: "9001" });
});

test("status só avança", () => {
  assert.equal(canTransition("pending", "approved"), true);
  assert.equal(canTransition("approved", "refunded"), true);
  assert.equal(canTransition("approved", "chargeback"), true);
  assert.equal(canTransition("approved", "pending"), false);
  assert.equal(canTransition("refunded", "approved"), false);
  assert.equal(canTransition("refused", "approved"), false);
  assert.equal(canTransition("refused", "refunded"), false);
});
