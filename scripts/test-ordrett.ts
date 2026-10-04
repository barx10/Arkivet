// Tester sitatsjekken. Kjør med: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { erOrdrett, rensSitat } from "@/lib/ordrett";

const kilde = `Mobiler ødelegger fokuset
Problemet er ikke LK20 eller intensjonen bak. Problemet er hvordan digitale
hjelpemidler fragmenterer fokuset vi trenger til å lese lengre tekster og romaner.
Og dette har en _grenseløs_ innvirkning, som Bjørnson nevner.`;

test("godtar sitat som står ordrett", () => {
  assert.ok(erOrdrett("Problemet er hvordan digitale hjelpemidler fragmenterer fokuset vi trenger", kilde));
});

test("godtar forskjeller i linjeskift og mellomrom", () => {
  assert.ok(erOrdrett("hvordan digitale  hjelpemidler fragmenterer\nfokuset vi trenger til å lese", kilde));
});

test("godtar at markdown-kursiv er fjernet", () => {
  assert.ok(erOrdrett("Og dette har en grenseløs innvirkning, som Bjørnson nevner.", kilde));
});

test("godtar anførselstegn og ellipse rundt sitatet", () => {
  assert.ok(erOrdrett("«… Problemet er hvordan digitale hjelpemidler fragmenterer fokuset …»", kilde));
});

test("avviser sitat med ett ord endret", () => {
  assert.equal(erOrdrett("Problemet er hvordan digitale verktøy fragmenterer fokuset vi trenger", kilde), false);
});

test("avviser sitat med endret tegnsetting inne i sitatet", () => {
  assert.equal(erOrdrett("Problemet er ikke LK20, eller intensjonen bak", kilde), false);
});

test("avviser oppdiktet sitat", () => {
  assert.equal(erOrdrett("Mobiltelefoner bør forbys i alle norske skoler fra første klasse", kilde), false);
});

test("avviser sammenslåing av to steder i teksten", () => {
  assert.equal(erOrdrett("Mobiler ødelegger fokuset vi trenger til å lese lengre tekster", kilde), false);
});

test("avviser for korte sitater", () => {
  assert.equal(erOrdrett("Problemet er ikke LK20", kilde), false);
});

test("rensSitat fjerner anførselstegn og ellipser", () => {
  assert.equal(rensSitat("«… et sitat her …»"), "et sitat her");
  assert.equal(rensSitat('"et sitat her"'), "et sitat her");
});
