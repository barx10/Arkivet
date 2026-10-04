// Tester ordsøket. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { finn, monster, utenOverlapp } from "@/lib/ordsok";
import type { Bit } from "@/lib/sok";

const bit = (fil: string, tekst: string, dato = "2022-01-01"): Bit => ({
  id: "0",
  fil,
  kilde: "artikkel",
  tittel: fil,
  dato,
  url: "",
  overskrift: "",
  tekst,
});

test("finner hele ord uavhengig av store og små bokstaver", () => {
  const re = monster("KI")!;
  assert.equal("KI i skolen. Ki er viktig. Kilder og ski.".match(re)?.length, 2);
});

test("stjerne gir alle ord som begynner slik", () => {
  const re = monster("mobil*")!;
  assert.deepEqual("Mobilen, mobilforbud og automobil.".match(re), ["Mobilen", "mobilforbud"]);
});

test("uttrykk tåler linjeskift mellom ordene", () => {
  assert.ok(monster("dannelse og læring")!.test("dannelse\nog  læring"));
});

test("for korte søk gir ingen treff", () => {
  assert.equal(monster("a"), null);
  assert.equal(monster("*"), null);
});

test("teller ikke overlappet mellom biter to ganger", () => {
  const forste = "Første del handler om noe annet. Så kommer mobilforbud i siste avsnitt her.";
  const andre = "Så kommer mobilforbud i siste avsnitt her. Og mobilforbud igjen.";
  const [t] = finn(utenOverlapp([bit("a.md", forste), bit("a.md", andre)]), "mobilforbud");
  assert.equal(t.antall, 2);
});

test("sorterer tekstene fra eldst til nyest", () => {
  const deler = utenOverlapp([bit("ny.md", "tillit", "2025-03-01"), bit("gammel.md", "tillit", "2019-05-01")]);
  assert.deepEqual(finn(deler, "tillit").map((t) => t.fil), ["gammel.md", "ny.md"]);
});
