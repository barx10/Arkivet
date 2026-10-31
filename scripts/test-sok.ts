// Tester rangeringen med og uten avgrensning til én tekst, og flettingen i grundig
// svar. Ingen API-kall. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { flett, lesPlan, MAKS_DELSOK } from "@/lib/grundig";
import { DIM, velgTreff, type Bit, type Treff } from "@/lib/sok";

// Bit i med vekt v langs første akse og resten langs andre, så skalarproduktet
// mot q = (1, 0, …) er v.
function oppsett(spek: { fil: string; dato: string; score: number }[]) {
  const biter: Bit[] = spek.map((s, i) => ({
    id: `b${i}`,
    fil: s.fil,
    kilde: "artikkel",
    tittel: s.fil,
    dato: s.dato,
    url: "",
    overskrift: "",
    tekst: `tekst ${i}`,
  }));
  const vektorer = new Float32Array(biter.length * DIM);
  spek.forEach((s, i) => {
    vektorer[i * DIM] = s.score;
    vektorer[i * DIM + 1] = Math.sqrt(1 - s.score ** 2);
  });
  const q = new Float32Array(DIM);
  q[0] = 1;
  return { biter, vektorer, q };
}

const SPEK = [
  { fil: "a.md", dato: "2014-01-01", score: 0.9 },
  { fil: "a.md", dato: "2014-01-01", score: 0.8 },
  { fil: "b.md", dato: "2020-01-01", score: 0.7 },
  { fil: "a.md", dato: "2014-01-01", score: 0.6 },
  { fil: "c.md", dato: "2025-01-01", score: 0.5 },
];

test("vanlig søk gir én bit per tekst i rangert rekkefølge", () => {
  const { biter, vektorer, q } = oppsett(SPEK);
  const treff = velgTreff(biter, vektorer, q);
  assert.deepEqual(treff.map((t) => t.id), ["b0", "b2", "b4"]);
});

test("avgrenset til én tekst gir flere biter fra den og ingen fra andre", () => {
  const { biter, vektorer, q } = oppsett(SPEK);
  const treff = velgTreff(biter, vektorer, q, { fil: "a.md" });
  assert.deepEqual(treff.map((t) => t.id), ["b0", "b1", "b3"]);
});

test("avgrensning til én tekst overstyrer årsfilteret", () => {
  const { biter, vektorer, q } = oppsett(SPEK);
  const treff = velgTreff(biter, vektorer, q, { fil: "a.md", fraAar: 2020 });
  assert.equal(treff.length, 3);
});

test("ukjent tekst gir ingen treff", () => {
  const { biter, vektorer, q } = oppsett(SPEK);
  assert.deepEqual(velgTreff(biter, vektorer, q, { fil: "finnes-ikke.md" }), []);
});

const treff = (fil: string): Treff => ({
  id: fil,
  fil,
  kilde: "artikkel",
  tittel: fil,
  dato: "2020-01-01",
  url: "",
  overskrift: "",
  tekst: "",
  score: 0,
});

test("flettingen tar annenhver fra listene, spørsmålet først, uten dobbelttreff", () => {
  const lister = [
    [treff("a"), treff("b"), treff("c")],
    [treff("b"), treff("d")],
    [treff("e"), treff("a"), treff("f")],
  ];
  assert.deepEqual(flett(lister, 10).map((t) => t.fil), ["a", "b", "e", "d", "c", "f"]);
  assert.deepEqual(flett(lister, 3).map((t) => t.fil), ["a", "b", "e"]);
  assert.deepEqual(flett([], 5), []);
});

test("planen leses fra JSON, uten gjentakelser og med øvre grense", () => {
  const sporsmal = "Hva mener jeg om KI?";
  assert.deepEqual(lesPlan('{"sok": ["KI i skolen", "ki i skolen", "  ", "hva mener jeg om ki?", "fusk"]}', sporsmal), [
    "KI i skolen",
    "fusk",
  ]);
  assert.deepEqual(lesPlan('```json\n{"sok": ["a"]}\n```', sporsmal), ["a"]);
  const mange = JSON.stringify({ sok: ["1", "2", "3", "4", "5", "6"] });
  assert.equal(lesPlan(mange, sporsmal).length, MAKS_DELSOK);
  assert.deepEqual(lesPlan("ikke json", sporsmal), []);
  assert.deepEqual(lesPlan('{"sok": "ett søk"}', sporsmal), []);
});
