import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePeriod, sameTimeZone } from "../src/lib/period.ts";

test("sameTimeZone trata nomes antigos como o mesmo fuso (BUG-6)", () => {
  assert.equal(sameTimeZone("Brazil/East", "America/Sao_Paulo"), true);
  assert.equal(sameTimeZone("America/Sao_Paulo", "America/Sao_Paulo"), true);
  assert.equal(sameTimeZone("America/Noronha", "America/Sao_Paulo"), false);
  assert.equal(sameTimeZone("Fuso/Inexistente", "America/Sao_Paulo"), false);
});

test("resolvePeriod usa o dia no fuso da operação", () => {
  // 01/11 01:30 UTC ainda é 31/10 em São Paulo
  const now = new Date("2026-11-01T01:30:00Z");
  assert.deepEqual(resolvePeriod("hoje", "America/Sao_Paulo", now), { key: "hoje", from: "2026-10-31", to: "2026-10-31" });
  assert.deepEqual(resolvePeriod("7d", "America/Sao_Paulo", now), { key: "7d", from: "2026-10-25", to: "2026-10-31" });
  assert.deepEqual(resolvePeriod("mes", "UTC", now), { key: "mes", from: "2026-11-01", to: "2026-11-01" });
  assert.equal(resolvePeriod("qualquer", "UTC", now).key, "hoje");
});
