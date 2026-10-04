// Tester kontrollen av Arbeid videre. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Kilde } from "@/lib/svar";
import { kontroller } from "@/lib/videre";

const kilde = (nr: number, fil: string): Kilde => ({
  nr,
  fil,
  kilde: "artikkel",
  tittel: fil,
  dato: "2022-01-01",
  url: "https://x",
  utdrag: [],
});
// Samtalen kjenner allerede 2 kilder; søket ga i tillegg nr 3, 4 og 5.
const alle = [kilde(1, "a.md"), kilde(3, "c.md"), kilde(4, "d.md"), kilde(5, "e.md")];

test("fjerner kildenumre som ikke finnes", () => {
  const r = kontroller([{ bolk: "fortsettelse", tekst: "x", opphav: "tekstene", kilder: [1, 99] }], alle, 2);
  assert.deepEqual(r.punkter[0].kilder, [1]);
});

test("tekstene uten gyldige kilder blir utenfra", () => {
  const r = kontroller([{ bolk: "perspektiv", tekst: "x", opphav: "tekstene", kilder: [99] }], alle, 2);
  assert.equal(r.punkter[0].opphav, "utenfra");
});

test("utenfra mister kilder", () => {
  const r = kontroller([{ bolk: "perspektiv", tekst: "x", opphav: "utenfra", kilder: [1] }], alle, 2);
  assert.deepEqual(r.punkter[0].kilder, []);
  assert.equal(r.nye.length, 0);
});

test("høyst 3 punkter per bolk", () => {
  const p = (tekst: string) => ({ bolk: "ide", tekst, tittel: tekst, opphav: "utenfra", kilder: [] });
  const r = kontroller([p("1"), p("2"), p("3"), p("4")], alle, 2);
  assert.equal(r.punkter.length, 3);
});

test("forkaster ugyldige punkter og fjerner [n] fra teksten", () => {
  const r = kontroller(
    [
      null,
      { bolk: "tull", tekst: "x" },
      { bolk: "ide", tekst: "  " },
      { bolk: "fortsettelse", tekst: "Følg tråden [1].", opphav: "tekstene", kilder: [1] },
    ],
    alle,
    2,
  );
  assert.equal(r.punkter.length, 1);
  assert.equal(r.punkter[0].tekst, "Følg tråden.");
});

test("nye kilder nummereres fortløpende etter de kjente, kjente beholder nummeret", () => {
  const r = kontroller(
    [
      { bolk: "fortsettelse", tekst: "x", opphav: "tekstene", kilder: [5] },
      { bolk: "perspektiv", tekst: "y", opphav: "tekstene", kilder: [1, 4] },
    ],
    alle,
    2,
  );
  assert.deepEqual(
    r.punkter.map((p) => p.kilder),
    [[3], [1, 4]],
  );
  assert.deepEqual(
    r.nye.map((k) => [k.nr, k.fil]),
    [
      [3, "e.md"],
      [4, "d.md"],
    ],
  );
});

test("tittel beholdes bare på ideer", () => {
  const r = kontroller([{ bolk: "perspektiv", tekst: "x", tittel: "T", opphav: "utenfra", kilder: [] }], alle, 2);
  assert.equal(r.punkter[0].tittel, undefined);
});
