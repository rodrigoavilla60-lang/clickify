import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  fbcFrom, hasStrongMatch, matchData, matchFields, normPhone, purchaseEvent, splitName, tooOld, validPixelId,
} from "../src/lib/capi.ts";
import { normalizeGeneric } from "../src/lib/normalize.ts";
import { normalizeKiwify } from "../src/lib/checkouts.ts";

const h = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const at = new Date("2026-11-01T15:00:00Z");

test("telefone ganha o 55 e só fica com dígitos", () => {
  assert.equal(normPhone("(11) 98765-4321"), "5511987654321");
  assert.equal(normPhone("+55 11 3456-7890"), "551134567890");
  assert.equal(normPhone("123"), null);
});

test("nome vira primeiro e último, sem acento e minúsculo", () => {
  assert.deepEqual(splitName("  Maria Conceição  da Silva "), { fn: "maria", ln: "silva" });
  assert.deepEqual(splitName("João"), { fn: "joao", ln: null });
});

test("dados do comprador saem com hash; IP, navegador e cookies sem hash", () => {
  const m = matchData(h("ana@x.com"), {
    name: "Ana Souza", phone: "11987654321", city: "São Paulo", state: "SP", zip: "01310-100",
    document: "123.456.789-09", ip: "200.100.50.1, 10.0.0.1", userAgent: "Mozilla/5.0", fbp: "fb.1.1700000000000.123456789",
  }, at);
  assert.deepEqual(m.em, [h("ana@x.com")]);
  assert.deepEqual(m.ph, [h("5511987654321")]);
  assert.deepEqual(m.fn, [h("ana")]);
  assert.deepEqual(m.ln, [h("souza")]);
  assert.deepEqual(m.ct, [h("saopaulo")]);
  assert.deepEqual(m.st, [h("sp")]);
  assert.deepEqual(m.zp, [h("01310100")]);
  assert.deepEqual(m.country, [h("br")]);
  assert.deepEqual(m.external_id, [h("12345678909")]);
  assert.equal(m.client_ip_address, "200.100.50.1");
  assert.equal(m.fbp, "fb.1.1700000000000.123456789");
  // Nada em claro além do que o Meta pede sem hash
  assert.ok(!JSON.stringify(m).includes("Ana"));
  assert.ok(!JSON.stringify(m).includes("98765"));
  assert.deepEqual(matchFields(m), ["e-mail", "telefone", "nome", "sobrenome", "cidade", "estado", "CEP", "país", "CPF/CNPJ", "IP", "navegador", "cookie do pixel"]);
});

test("fbclid do link vira fbc; fbc e IP inválidos são descartados", () => {
  assert.equal(fbcFrom({ fbclid: "AbC123" }, at), `fb.1.${at.getTime()}.AbC123`);
  assert.equal(fbcFrom({ fbc: "fb.1.1700000000000.XyZ" }, at), "fb.1.1700000000000.XyZ");
  const m = matchData(null, { fbc: "lixo", ip: "não é ip", fbp: "abc" }, at);
  assert.equal(m.fbc, undefined);
  assert.equal(m.client_ip_address, undefined);
  assert.equal(m.fbp, undefined);
  assert.equal(hasStrongMatch(m), false);
});

test("evento de compra: id do pedido como event_id, valor em reais, nunca no futuro", () => {
  const e = purchaseEvent({ externalId: "PED-9", amountCents: 19790, currency: "brl", productName: "Kit", approvedAt: new Date("2030-01-01") }, { em: ["x"] }, at);
  assert.equal(e.event_id, "PED-9");
  assert.equal(e.custom_data.value, 197.9);
  assert.equal(e.custom_data.currency, "BRL");
  assert.equal(e.event_time, Math.floor(at.getTime() / 1000));
  assert.equal(e.action_source, "website");
});

test("compra com mais de 7 dias não vai; ID do pixel só com dígitos", () => {
  assert.equal(tooOld(new Date("2026-10-20T00:00:00Z"), at), true);
  assert.equal(tooOld(new Date("2026-10-30T00:00:00Z"), at), false);
  assert.equal(validPixelId("123456789012345"), true);
  assert.equal(validPixelId("12345abc"), false);
});

test("checkouts entregam o comprador para o pixel", () => {
  const g = normalizeGeneric({
    id: "G1", status: "paid", amount: 10, email: "a@b.com",
    customer: { name: "Bia Lima", phone: "21999998888" }, ip: "189.1.2.3", url: "https://loja.com/?fbclid=QWE",
  });
  assert.equal(g.buyer?.name, "Bia Lima");
  assert.equal(g.buyer?.phone, "21999998888");
  assert.equal(g.buyer?.ip, "189.1.2.3");
  assert.equal(g.buyer?.fbclid, "QWE");
  const k = normalizeKiwify({
    order_id: "K1", order_status: "paid", Commissions: { charge_amount: 1000 },
    Customer: { email: "c@d.com", full_name: "Caio Reis", mobile: "+5531988887777", CPF: "11122233344", ip: "177.1.1.1" },
  });
  assert.equal(k?.buyer?.name, "Caio Reis");
  assert.equal(k?.buyer?.phone, "+5531988887777");
  assert.equal(k?.buyer?.document, "11122233344");
  assert.equal(k?.buyer?.ip, "177.1.1.1");
});
