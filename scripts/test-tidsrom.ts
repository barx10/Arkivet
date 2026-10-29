// Tester årsfilteret i søket. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { iTidsrom, lesTidsrom } from "@/lib/sok";

test("tidsrommet tar med begge grensene", () => {
  const rom = { fraAar: 2014, tilAar: 2018 };
  assert.equal(iTidsrom("2013-12-31", rom), false);
  assert.equal(iTidsrom("2014-01-01", rom), true);
  assert.equal(iTidsrom("2018", rom), true);
  assert.equal(iTidsrom("2019-01-01", rom), false);
});

test("en åpen grense slipper alt gjennom på den siden", () => {
  assert.equal(iTidsrom("2026-10-01", { fraAar: 2014 }), true);
  assert.equal(iTidsrom("2012-02-20", { tilAar: 2014 }), true);
  assert.equal(iTidsrom("2012-02-20", {}), true);
});

test("bare heltall leses fra forespørselen", () => {
  assert.deepEqual(lesTidsrom({ fraAar: 2014, tilAar: 2018 }), { fraAar: 2014, tilAar: 2018 });
  assert.deepEqual(lesTidsrom({ fraAar: "2014", tilAar: 2018.5 }), { fraAar: undefined, tilAar: undefined });
});
