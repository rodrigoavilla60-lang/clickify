// Exemplos montados a partir dos campos documentados por cada plataforma (docs.kiwify.com.br,
// developers.hotmart.com, docs.yampi.com.br, developers.eduzz.com). Confirmar com a 1ª venda real.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  metaIdsFrom, normalizeEduzz, normalizeHotmart, normalizeKiwify, normalizeYampi, signatureOk, toDateBr,
} from "../src/lib/checkouts.ts";
import { attribute, paymentMethodOf } from "../src/lib/normalize.ts";

const URL0 = new URL("https://x.test/api/webhooks/t");

test("Kiwify: vetor de teste oficial da assinatura", () => {
  const body = '{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}';
  const url = new URL("https://x.test/api/webhooks/t?signature=bf18f352a4f981b91dfa3f6d8742a81080ab8c86");
  assert.equal(signatureOk("kiwify", "kiwify-token-de-teste", body, new Headers(), url), true);
  assert.equal(signatureOk("kiwify", "outro-token", body, new Headers(), url), false);
  assert.equal(signatureOk("kiwify", "kiwify-token-de-teste", body + " ", new Headers(), url), false);
});

test("Kiwify: compra aprovada com UTMs, centavos e horário de Brasília", () => {
  const o = normalizeKiwify({
    order_id: "9b1c2d3e", order_status: "paid", webhook_event_type: "order_approved", payment_method: "pix",
    created_at: "2026-11-01 22:30", approved_date: "2026-11-01 22:31",
    Product: { product_name: "Kit Conforto" }, Customer: { email: "a@b.com" },
    Commissions: { charge_amount: "19790", currency: "BRL" },
    TrackingParameters: { utm_source: "FB", utm_campaign: "Camp|120001", utm_medium: "Conj|120002", utm_content: "Ad|120003" },
  })!;
  assert.equal(o.status, "approved");
  assert.equal(o.amountCents, 19790);
  assert.equal(o.productName, "Kit Conforto");
  assert.equal(o.paymentMethod, "pix");
  // 22:30 em Brasília = 01:30 UTC do dia seguinte
  assert.equal(o.orderedAt.toISOString(), "2026-11-02T01:30:00.000Z");
  assert.deepEqual(attribute(o), { campaign: "120001", adset: "120002", ad: "120003" });
});

test("Kiwify: formato da API (minúsculas) e reembolso", () => {
  const o = normalizeKiwify({
    id: "abc", status: "refunded", payment: { charge_amount: 10388 }, product: { name: "X" },
    customer: { email: "c@d.com" }, tracking: { utm_campaign: "C|120009" },
  })!;
  assert.equal(o.status, "refunded");
  assert.equal(o.amountCents, 10388);
  assert.equal(attribute(o).campaign, "120009");
});

test("Kiwify: carrinho abandonado é ignorado e status estranho dá erro claro", () => {
  assert.equal(normalizeKiwify({ cart_id: "x", email: "a@b.com" }), null);
  assert.throws(() => normalizeKiwify({ order_id: "1", order_status: "talvez" }), /status da Kiwify desconhecido/);
});

test("Hotmart: compra aprovada, reais, ms e IDs do Meta no sck", () => {
  const o = normalizeHotmart({
    id: "evt-1", event: "PURCHASE_APPROVED", version: "2.0.0",
    data: {
      product: { name: "Curso" }, buyer: { email: "x@y.com" },
      purchase: {
        transaction: "HP17715690036014", status: "APPROVED",
        price: { value: 197.9, currency_value: "BRL" },
        order_date: 1793541600000, approved_date: 1793541660000,
        payment: { type: "CREDIT_CARD" },
        origin: { src: "FB", sck: "120001-120002-120003" },
      },
    },
  });
  assert.equal(o.externalId, "HP17715690036014");
  assert.equal(o.amountCents, 19790);
  assert.equal(o.paymentMethod, "card");
  assert.equal(o.approvedAt?.getTime(), 1793541660000);
  assert.deepEqual(attribute(o), { campaign: "120001", adset: "120002", ad: "120003" });
});

test("Hotmart: status mapeados e assinatura pelo hottok", () => {
  const base = (status: string) => ({ data: { purchase: { transaction: "T", status, price: { value: 10 } } } });
  assert.equal(normalizeHotmart(base("PRINTED_BILLET")).status, "pending");
  assert.equal(normalizeHotmart(base("EXPIRED")).status, "refused");
  assert.equal(normalizeHotmart(base("REFUNDED")).status, "refunded");
  assert.equal(normalizeHotmart(base("CHARGEBACK")).status, "chargeback");
  assert.equal(signatureOk("hotmart", "tok", "{}", new Headers({ "X-HOTMART-HOTTOK": "tok" }), URL0), true);
  assert.equal(signatureOk("hotmart", "tok", "{}", new Headers({ "X-HOTMART-HOTTOK": "nope" }), URL0), false);
});

test("Yampi: pedido pago, UTMs no resource e assinatura base64", () => {
  const payload = {
    event: "order.paid", time: "2026-11-01 10:00:00",
    resource: {
      id: 1000001, number: 123456789012, value_total: 199.9,
      status: { data: { alias: "paid", name: "Pago" } },
      customer: { data: { email: "cliente@exemplo.com" } },
      items: { data: [{ sku: { data: { title: "Produto Exemplo" } } }] },
      payments: [{ alias: "pix", name: "Pix" }],
      created_at: { date: "2026-11-01 09:59:00.000000", timezone_type: 3, timezone: "America/Sao_Paulo" },
      updated_at: { date: "2026-11-01 10:00:00.000000", timezone_type: 3, timezone: "America/Sao_Paulo" },
      utm_source: "FB", utm_campaign: "C|120001", utm_medium: "S|120002", utm_content: "A|120003", utm_term: null,
    },
  };
  const o = normalizeYampi(payload)!;
  assert.equal(o.externalId, "1000001");
  assert.equal(o.amountCents, 19990);
  assert.equal(o.status, "approved");
  assert.equal(o.paymentMethod, "pix");
  assert.equal(o.orderedAt.toISOString(), "2026-11-01T12:59:00.000Z");
  assert.equal(attribute(o).ad, "120003");
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", "seg").update(raw).digest("base64");
  assert.equal(signatureOk("yampi", "seg", raw, new Headers({ "X-Yampi-Hmac-SHA256": sig }), URL0), true);
  assert.equal(normalizeYampi({ event: "product.updated", resource: {} }), null);
});

test("Eduzz: fatura paga com utm e tracker, assinatura hex ou base64", () => {
  const payload = {
    id: "evt-9", event: "myeduzz.invoice_paid", sentDate: "2026-11-01T13:00:00.000Z",
    data: {
      id: "INV-1", status: "paid", price: { value: 301.5, currency: "BRL" }, paid: { value: 301.5, currency: "BRL" },
      paymentMethod: "creditCard", items: [{ name: "Widget X" }], buyer: { email: "b@c.com" },
      createdAt: "2026-11-01T12:58:00.000Z", paidAt: "2026-11-01T13:00:00.000Z",
      utm: { source: "FB", campaign: "C|120001", medium: "S|120002", content: "A|120003", term: null },
    },
  };
  const o = normalizeEduzz(payload)!;
  assert.equal(o.amountCents, 30150);
  assert.equal(o.status, "approved");
  assert.equal(o.paymentMethod, "card");
  assert.deepEqual(attribute(o), { campaign: "120001", adset: "120002", ad: "120003" });
  const raw = JSON.stringify(payload);
  for (const enc of ["hex", "base64"] as const) {
    const sig = crypto.createHmac("sha256", "k").update(raw).digest(enc);
    assert.equal(signatureOk("eduzz", "k", raw, new Headers({ "x-signature": sig }), URL0), true, enc);
  }
  assert.equal(normalizeEduzz({ event: "myeduzz.invoice_refunded", data: { id: "INV-1" } })!.status, "refunded");
});

test("ajudantes: forma de pagamento, IDs do Meta e datas", () => {
  assert.equal(paymentMethodOf("BILLET"), "boleto");
  assert.equal(paymentMethodOf("bankslip"), "boleto");
  assert.equal(paymentMethodOf("creditCard"), "card");
  assert.equal(paymentMethodOf("PAYPAL"), "other");
  assert.equal(paymentMethodOf(""), null);
  assert.deepEqual(metaIdsFrom("", "a_120001_120002_120003_x"), ["120001", "120002", "120003"]);
  assert.equal(toDateBr("2026-11-01T13:00:00.000Z")?.toISOString(), "2026-11-01T13:00:00.000Z");
  assert.equal(toDateBr(1793541600000)?.getTime(), 1793541600000);
});
