import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFunnel, parseActions } from "../src/lib/funnel.ts";

test("parseActions prefere omni_ e não soma aliases do mesmo evento", () => {
  const a = parseActions([
    { action_type: "landing_page_view", value: "40" },
    { action_type: "omni_add_to_cart", value: "12" },
    { action_type: "add_to_cart", value: "12" },
    { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "5" },
    { action_type: "link_click", value: "50" },
  ]);
  assert.deepEqual(a, { landingPageViews: 40, addToCart: 12, initiateCheckout: 5 });
  assert.deepEqual(parseActions(undefined), { landingPageViews: 0, addToCart: 0, initiateCheckout: 0 });
});

test("buildFunnel calcula % dos cliques e da etapa anterior", () => {
  const f = buildFunnel({ clicks: 100, pageViews: 80, addToCart: 20, checkout: 10, orders: 8, approved: 6 });
  assert.deepEqual(f.steps.map((s) => s.key), ["clicks", "pageViews", "addToCart", "checkout", "orders", "approved"]);
  assert.equal(f.steps[1].ofFirst, 0.8);
  assert.equal(f.steps[2].fromPrev, 0.25);
  assert.equal(f.steps[5].ofFirst, 0.06);
  assert.equal(f.enoughData, true);
});

test("o maior vazamento é a etapa que mais perde em relação à anterior", () => {
  const f = buildFunnel({ clicks: 100, pageViews: 90, addToCart: 0, checkout: 9, orders: 8, approved: 7 });
  assert.equal(f.leak?.from.key, "pageViews");
  assert.equal(f.leak?.to.key, "checkout");
  assert.ok(Math.abs((f.leak?.lost ?? 0) - 0.9) < 1e-9);
  assert.match(f.leak?.advice ?? "", /página não está convencendo/);
});

test("etapa com pouca gente não vira o maior vazamento (caso real da VittaConfort)", () => {
  // 125 cliques, 3 viram a página, 0 checkout: 100% de 3 pessoas não é o problema, 97,6% de 125 é.
  const f = buildFunnel({ clicks: 125, pageViews: 3, addToCart: 0, checkout: 0, orders: 0, approved: 0 });
  assert.equal(f.leak?.from.key, "clicks");
  assert.equal(f.leak?.to.key, "pageViews");
});

test("carrinho some quando a loja não manda o evento", () => {
  const f = buildFunnel({ clicks: 50, pageViews: 40, addToCart: 0, checkout: 4, orders: 3, approved: 2 });
  assert.ok(!f.steps.some((s) => s.key === "addToCart"));
});

test("etapa maior que a anterior não vira vazamento negativo", () => {
  // Pedidos podem passar dos checkouts do pixel (pixel bloqueado, outro navegador...).
  const f = buildFunnel({ clicks: 40, pageViews: 30, addToCart: 0, checkout: 2, orders: 5, approved: 5 });
  assert.equal(f.leak?.to.key, "checkout");
  assert.ok(f.steps.every((s) => s.fromPrev === null || s.fromPrev >= 0));
});

test("sem cliques não divide por zero e avisa que faltam dados", () => {
  const f = buildFunnel({ clicks: 0, pageViews: 0, addToCart: 0, checkout: 0, orders: 0, approved: 0 });
  assert.equal(f.leak, null);
  assert.equal(f.enoughData, false);
  assert.ok(f.steps.every((s) => s.ofFirst === null));
});
