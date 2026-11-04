import { test } from "node:test";
import assert from "node:assert/strict";
import { progress, shortMoney, TIERS } from "../src/lib/milestones.ts";

test("começo: nada batido, barra até R$ 10 mil", () => {
  const p = progress(250_000); // R$ 2.500
  assert.deepEqual(p.reached, []);
  assert.equal(p.next, 1_000_000);
  assert.equal(p.from, 0);
  assert.equal(p.pct, 0.25);
  assert.equal(p.missing, 750_000);
});

test("no meio: a barra conta a partir do último degrau batido", () => {
  const p = progress(7_500_000); // R$ 75 mil
  assert.deepEqual(p.reached, [1_000_000, 5_000_000]);
  assert.equal(p.next, 10_000_000);
  assert.equal(p.pct, 0.5);
});

test("bateu exatamente o degrau e passou de todos", () => {
  assert.deepEqual(progress(1_000_000).reached, [1_000_000]);
  const top = progress(TIERS[TIERS.length - 1] * 2);
  assert.equal(top.next, null);
  assert.equal(top.pct, 1);
  assert.equal(top.missing, 0);
});

test("valores curtos", () => {
  assert.equal(shortMoney(1_000_000), "R$ 10 mil");
  assert.equal(shortMoney(100_000_000), "R$ 1 mi");
  assert.equal(shortMoney(150_000_000), "R$ 1,5 mi");
  assert.equal(shortMoney(98_700), "R$ 987");
});
