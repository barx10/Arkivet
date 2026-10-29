// Tester tallene til statistikksiden. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Vurdering } from "@/lib/lager";
import { kilderIVurderinger, sisteDager, vurderingerPerManed } from "@/lib/statistikk";

const vurdering = (tid: string, dom: "opp" | "ned", filer: string[] = []): Vurdering => ({
  tid,
  dom,
  sporsmal: "",
  svar: "",
  tidligere: [],
  kilder: filer.map((fil) => ({ fil, tittel: fil.toUpperCase(), dato: "2021-05-01" })),
});

test("siste dager fylles med 0 og går over månedsskifte", () => {
  assert.deepEqual(sisteDager({ "2026-10-01": 3, "2026-09-29": 1 }, "2026-10-01", 4), [
    { dag: "2026-09-28", antall: 0 },
    { dag: "2026-09-29", antall: 1 },
    { dag: "2026-09-30", antall: 0 },
    { dag: "2026-10-01", antall: 3 },
  ]);
});

test("vurderinger telles per måned, med tomme måneder mellom", () => {
  const ut = vurderingerPerManed([
    vurdering("2027-01-05T10:00:00Z", "ned"),
    vurdering("2026-11-02T10:00:00Z", "opp"),
    vurdering("2026-11-20T10:00:00Z", "opp"),
  ]);
  assert.deepEqual(ut, [
    { maned: "2026-11", opp: 2, ned: 0 },
    { maned: "2026-12", opp: 0, ned: 0 },
    { maned: "2027-01", opp: 0, ned: 1 },
  ]);
  assert.deepEqual(vurderingerPerManed([]), []);
});

test("kilder telles én gang per svar og sorteres etter bruk", () => {
  const ut = kilderIVurderinger(
    [
      vurdering("2026-10-01T00:00:00Z", "opp", ["a", "b", "a"]),
      vurdering("2026-10-02T00:00:00Z", "ned", ["b"]),
      vurdering("2026-10-03T00:00:00Z", "opp", ["c"]),
    ],
    2,
  );
  assert.deepEqual(ut, [
    { fil: "b", tittel: "B", aar: "2021", opp: 1, ned: 1 },
    { fil: "a", tittel: "A", aar: "2021", opp: 1, ned: 0 },
  ]);
});
