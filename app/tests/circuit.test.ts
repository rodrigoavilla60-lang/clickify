import { test } from "node:test";
import assert from "node:assert/strict";
import { circuit, COL, traceCounts } from "../src/lib/circuit.ts";

test("trilhas: raiz quadrada, mínimo 1 para quem tem alguém, nunca aumenta", () => {
  assert.deepEqual(traceCounts([1, 0.25, 0.04, 0.002, 0]), [12, 6, 2, 1, 0]);
  // Etapa maior que a anterior (carrinho > visitas) não ganha trilha nova
  assert.deepEqual(traceCounts([1, 0.3, 0.5]), [12, 7, 7]);
  assert.deepEqual(traceCounts([null, null]), [0, 0]);
});

test("as de fora terminam primeiro; as que chegam ao fim vão até a última coluna", () => {
  const t = circuit([1, 0.25, 0.04, 0.002]);
  assert.equal(t.length, 12);
  const ending = t.filter((x) => x.reachesEnd);
  assert.equal(ending.length, 1);
  // A que sobra é a mais perto do centro
  const mid = 50;
  const closest = Math.min(...t.map((x) => Math.abs(x.y - mid)));
  assert.equal(Math.abs(ending[0].y - mid), closest);
  assert.ok(ending[0].end.x > 3 * COL);
  // Quem parou na coluna 0 dobra dentro da coluna 1
  const early = t.filter((x) => x.lastCol === 0);
  assert.equal(early.length, 6);
  for (const e of early) assert.ok(e.end.x > COL && e.end.x < 2 * COL);
});

test("dobra em 45° na direção do centro", () => {
  const top = circuit([1, 0.04]).find((x) => !x.reachesEnd && x.y < 50)!;
  assert.ok(top.end.y > top.y);
  const bottom = circuit([1, 0.04]).find((x) => !x.reachesEnd && x.y > 50)!;
  assert.ok(bottom.end.y < bottom.y);
});
