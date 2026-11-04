import { test } from "node:test";
import assert from "node:assert/strict";
import { centsToNumber, toCsv } from "../src/lib/csv.ts";

test("formato do Excel em português: ponto e vírgula, vírgula decimal e BOM", () => {
  const csv = toCsv(["Pedido", "Valor"], [["A-1", centsToNumber(19790)], ["A-2", 3.5]]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv.slice(1), "Pedido;Valor\r\nA-1;197,9\r\nA-2;3,5\r\n");
});

test("texto com ; aspas ou quebra de linha é protegido", () => {
  const csv = toCsv(["x"], [['Kit "A"; azul'], ["linha\nnova"]]);
  assert.match(csv, /"Kit ""A""; azul"/);
  assert.match(csv, /"linha\nnova"/);
});

test("fórmula vira texto e vazio fica vazio", () => {
  const csv = toCsv(["x", "y"], [["=HYPERLINK(\"http://mal\")", null], ["-1+1", undefined]]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'-1\+1;/);
  assert.match(csv, /;\r\n/);
});
