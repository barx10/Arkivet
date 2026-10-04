// Tester øktarkivet. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { leggTil, lesOkter, skrivOkter, type Okt } from "@/lib/okter";

const okt = (id: string, endret = 0): Okt<{ sporsmal: string }> => ({
  id,
  endret,
  turer: [{ sporsmal: id }],
  kilder: [],
});

test("tom, ødelagt eller ukjent lagring gir ingen økter", () => {
  assert.deepEqual(lesOkter(null), []);
  assert.deepEqual(lesOkter("{"), []);
  assert.deepEqual(lesOkter(JSON.stringify({ versjon: 2, okter: [okt("a")] })), []);
});

test("lagrede økter leses tilbake", () => {
  const okter = [okt("a", 2), okt("b", 1)];
  assert.deepEqual(lesOkter(skrivOkter(okter)), okter);
});

test("ny økt legges øverst", () => {
  assert.deepEqual(leggTil([okt("a")], okt("b")).map((o) => o.id), ["b", "a"]);
});

test("oppdatert økt flyttes øverst uten å bli dobbel", () => {
  const ut = leggTil([okt("a"), okt("b"), okt("c")], okt("b", 5));
  assert.deepEqual(ut.map((o) => o.id), ["b", "a", "c"]);
  assert.equal(ut[0].endret, 5);
});

test("den eldste faller ut når arkivet er fullt", () => {
  const okter = ["a", "b", "c"].map((id) => okt(id));
  assert.deepEqual(leggTil(okter, okt("d"), 3).map((o) => o.id), ["d", "a", "b"]);
});
