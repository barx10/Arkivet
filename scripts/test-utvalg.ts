// Tester utvalget: lagring, kopi av turer og omnummerering. Kjør med: npm test

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Packer } from "docx";
import { byggDokument } from "@/lib/dokument";
import type { Kilde } from "@/lib/svar";
import { bitDel, filnavn, forbered, lesUtvalg, skrivUtvalg, turId, turTilDel, type Del, type TurDel } from "@/lib/utvalg";

const X = { tittel: "Mobilforbud", dato: "2023-04-01", url: "https://x.no/mobil" };
const Y = { tittel: "Tillitsreformen", dato: "2024-01-10", url: "https://x.no/tillit" };
const Z = { tittel: "Boktittel", dato: "2022", url: "https://x.no/bok" };

const sitat: Del = { type: "sitat", id: "sitat:a", tekst: "Mobiler ødelegger fokuset", kilde: X };

const kilde = (nr: number, k: typeof X): Kilde => ({
  ...k, nr, fil: `${nr}.md`, kilde: "artikkel", utdrag: [{ overskrift: "", tekst: "…" }],
});

const tur = (id: string, svar: string, kilder: TurDel["kilder"], videre: TurDel["videre"] = []): TurDel => ({
  type: "tur", id, sporsmal: id, svar, bakgrunn: "", sitater: [], videre, kilder,
});

test("tom eller manglende lagring gir tomt utvalg", () => {
  assert.deepEqual(lesUtvalg(null), []);
  assert.deepEqual(lesUtvalg(""), []);
});

test("ødelagt lagring gir tomt utvalg", () => {
  assert.deepEqual(lesUtvalg("{ikke json"), []);
  assert.deepEqual(lesUtvalg('{"versjon":1,"deler":"feil"}'), []);
});

test("annen versjon gir tomt utvalg", () => {
  assert.deepEqual(lesUtvalg('{"versjon":2,"deler":[]}'), []);
});

test("det som skrives, kan leses igjen", () => {
  assert.deepEqual(lesUtvalg(skrivUtvalg([sitat])), [sitat]);
});

test("turTilDel tar med kildene svaret og Arbeid videre viser til, og bare dem", () => {
  const del = turTilDel(
    {
      sporsmal: "mobilforbud",
      sok: "Hva mener jeg om mobilforbud?",
      svar: "Du var mot [1]. Senere for [3].",
      sitater: { status: "ferdig", liste: [{ sitat: "Mobiler ødelegger", ...X }] },
      videre: { status: "ferdig", punkter: [{ bolk: "ide", tekst: "Skriv om tillit", opphav: "tekstene", kilder: [2] }] },
    },
    [kilde(1, X), kilde(2, Y), kilde(3, Z), kilde(4, X)],
  );
  assert.equal(del.id, turId({ sporsmal: "mobilforbud", svar: "Du var mot [1]. Senere for [3]." }));
  assert.deepEqual(Object.keys(del.kilder).map(Number).sort(), [1, 2, 3]);
  assert.deepEqual(del.kilder[2], Y);
  assert.deepEqual(del.sitater, [{ sitat: "Mobiler ødelegger", kilde: X }]);
});

test("turTilDel skiller ut bakgrunnen og tar bare med ferdig generell kunnskap", () => {
  const del = turTilDel(
    {
      sporsmal: "Hvem var Bjørnson?",
      svar: "Du nevner ham [1].<bakgrunn>Norsk forfatter.</bakgrunn>",
      generelt: { status: "skriver", tekst: "Halv" },
    },
    [kilde(1, X)],
  );
  assert.equal(del.svar, "Du nevner ham [1].");
  assert.equal(del.bakgrunn, "Norsk forfatter.");
  assert.equal(del.generelt, undefined);
});

test("bitDel gir samme id for samme tekst fra samme kilde", () => {
  assert.equal(bitDel("utdrag", " a ", X).id, bitDel("utdrag", "a", X).id);
  assert.notEqual(bitDel("utdrag", "a", X).id, bitDel("sitat", "a", X).id);
});

test("kilder nummereres etter første forekomst på tvers av turer", () => {
  const f = forbered([
    tur("a", "Først [2], så [1].", { 1: X, 2: Y }),
    tur("b", "Igjen [1, 5].", { 1: Y, 5: Z }),
  ]);
  assert.deepEqual(f.kilder, [Y, X, Z]);
  assert.equal(f.turer[0].svar, "Først [1], så [2].");
  assert.equal(f.turer[1].svar, "Igjen [1, 3].");
});

test("ukjente numre fjernes, og tomme henvisninger forsvinner helt", () => {
  const f = forbered([tur("a", "Ett [1, 9]. To [9].", { 1: X })]);
  assert.equal(f.turer[0].svar, "Ett [1]. To.");
});

test("Arbeid videre får nye numre, og ukjente fjernes", () => {
  const f = forbered([
    tur("a", "Svar [3].", { 3: X, 4: Y }, [{ bolk: "ide", tekst: "Idé", opphav: "tekstene", kilder: [4, 3, 8] }]),
  ]);
  assert.deepEqual(f.turer[0].videre[0].kilder, [2, 1]);
});

test("sitater i turer og festede deler får numre fra samme liste", () => {
  const a = { ...tur("a", "Svar [1].", { 1: X }), sitater: [{ sitat: "s", kilde: Y }] };
  const f = forbered([sitat, a, bitDel("utdrag", "u", Z, "Del 2")]);
  assert.deepEqual(f.kilder, [X, Y, Z]);
  assert.equal(f.turer[0].sitater[0].nr, 2);
  assert.deepEqual(f.biter.map((b) => b.nr), [1, 3]);
});

// Pakker ut en del av .docx-fila (som er en zip) med systemets unzip.
async function xml(f: ReturnType<typeof forbered>, del: string) {
  const fil = path.join(mkdtempSync(path.join(tmpdir(), "utvalg-")), "test.docx");
  writeFileSync(fil, await Packer.toBuffer(byggDokument(f, { tittel: "Utvalg fra Arkivet", dato: new Date(2026, 9, 2) })));
  return execFileSync("unzip", ["-p", fil, del]).toString();
}

test("dokumentet har overskrifter, sitater, merking og kildeliste med lenker", async () => {
  const a: TurDel = {
    ...tur("a", "Du var **mot** [1].", { 1: X }, [
      { bolk: "ide", tekst: "Skriv om skjerm", opphav: "utenfra", kilder: [], tittel: "Skjermfri skole" },
    ]),
    sporsmal: "mobilforbud",
    sok: "Hva mener jeg om mobilforbud?",
    sitater: [{ sitat: "Mobiler ødelegger fokuset", kilde: X }],
  };
  const f = forbered([a, bitDel("utdrag", "Et utdrag", Y, "Kapittel 2")]);
  const dok = await xml(f, "word/document.xml");
  const lenker = await xml(f, "word/_rels/document.xml.rels");

  for (const tekst of [
    "Utvalg fra Arkivet", "2. oktober 2026", "Mobilforbud", "Søkte etter: Hva mener jeg om mobilforbud?",
    "mot", "Mobiler ødelegger fokuset", "Arbeid videre · forslag, ikke din tekst",
    "Ideer til nye artikler", "Skjermfri skole", "utenfra · ikke fra tekstene dine",
    "Festede sitater og utdrag", "Et utdrag", "Kapittel 2", "Kilder", "Tillitsreformen",
  ]) {
    assert.ok(dok.includes(tekst), `mangler «${tekst}»`);
  }
  assert.ok(dok.includes('w:val="Heading1"'), "mangler Overskrift 1");
  assert.ok(dok.includes('w:val="Quote"'), "mangler sitatstil");
  assert.ok(dok.includes("<w:b/>"), "**mot** skal bli fet");
  assert.ok(lenker.includes('Target="https://x.no/mobil"') && lenker.includes('TargetMode="External"'));
});

test("tomme deler gir ingen tomme seksjoner", async () => {
  const dok = await xml(forbered([tur("a", "Svar.", {})]), "word/document.xml");
  assert.ok(!dok.includes("Festede sitater og utdrag"));
  assert.ok(!dok.includes("Arbeid videre"));
});

test("avsnitt og overskrifter har luft rundt seg", async () => {
  const stiler = await xml(forbered([tur("a", "Svar.", {})]), "word/styles.xml");
  const avsnitt = stiler.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)?.[0] ?? "";
  assert.match(avsnitt, /w:after="\d+"/, "avsnitt mangler luft etter");
  const overskrift = stiler.match(/<w:style [^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/)?.[0] ?? "";
  assert.match(overskrift, /w:before="\d+"/, "Overskrift 1 mangler luft før");
});

test("filnavnet bygger på tittelen og datoen", () => {
  const dato = new Date(2026, 9, 2);
  assert.equal(filnavn("Mobil i skolen", dato), "Mobil i skolen 2026-10-02.docx");
  assert.equal(filnavn("  Hva er: KI/AI?  ", dato), "Hva er KI AI 2026-10-02.docx");
  assert.equal(filnavn("", dato), "Arkivet 2026-10-02.docx");
});
