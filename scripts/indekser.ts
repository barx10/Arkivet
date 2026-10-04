// Bygger data/biter.json og data/vektorer.bin fra markdown-filene i tekster/.
//
// Kjør med: npm run indekser               (deler opp, vektoriserer nye biter, skriver filene)
//           npm run indekser -- --sjekk    (viser hva som ville skjedd, uten API-kall eller skriving)
// Valg:     --tekster <mappe>  (standard: tekster)   --ut <mappe>  (standard: data)
//
// Endres oppdelingsreglene, får nye biter en annen form enn de gamle, og da bør alt
// vektoriseres på nytt (slett data/ først).
//
// Vektorer gjenbrukes når teksten som embeddes er uendret. Bare nye eller endrede
// biter sendes til Gemini. id er en løpende teller og brukes derfor ikke som nøkkel.

import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });

type Bit = {
  id: string;
  fil: string;
  kilde: "artikkel" | "bok";
  tittel: string;
  dato: string;
  url: string;
  overskrift: string;
  tekst: string;
};

const FELT = ["id", "fil", "kilde", "tittel", "dato", "url", "overskrift", "tekst"] as const;

const MIN_ORD = 120;
const MAKS_ORD = 400;
const BATCH = 50;
// JavaScript sin \b er ikke Unicode-bevisst. Dette erstatter den.
const ORDTEGN = String.raw`[\p{L}\p{N}_]`;

// Deler på all blanktegn og dropper tomme deler.
const ord = (s: string) => s.split(/\s+/).filter(Boolean);
const antallOrd = (s: string) => ord(s).length;

// Som split("\n"), men uten tom siste linje etter avsluttende \n.
function linjer(s: string): string[] {
  const ls = s.split("\n");
  if (ls.at(-1) === "") ls.pop();
  return ls;
}

// ---------- lag_biter ----------

function rensRa(tekst: string, bok: boolean): string {
  tekst = tekst.replace(/^-{3,}\s*$/gm, "");
  tekst = tekst.replace(/^.*intentionally omitted.*$/gm, "");
  return tekst.replace(bok ? /\*\*/g : /\*+/g, "");
}

// Kursiv som _ord_ i bøkene. Ordtegn rundt hindrer treff i snake_case og URL-er.
const KURSIV = new RegExp(String.raw`(?<!${ORDTEGN})_([^_\n]+?)_(?!${ORDTEGN})`, "gu");

function rensKursiv(tekst: string): string {
  return tekst.replace(KURSIV, "$1");
}

function seksjoner(tekst: string): [string, string][] {
  const ut: [string, string][] = [];
  let overskrift = "";
  let buf: string[] = [];
  let iKode = false;
  for (const l of linjer(tekst)) {
    if (l.trim().startsWith("```")) iKode = !iKode;
    const m = iKode ? null : l.match(/^#{1,6}\s+(.+)$/);
    if (m) {
      ut.push([overskrift, buf.join("\n").trim()]);
      overskrift = m[1].trim();
      buf = [];
    } else {
      buf.push(l);
    }
  }
  ut.push([overskrift, buf.join("\n").trim()]);
  return ut.filter(([o, t]) => t || o);
}

function blokker(deler: [string, string][]): [string, string][] {
  const ut: [string, string][] = [];
  let foerste = "";
  let buf: string[] = [];
  for (const [o, t] of deler) {
    if (!buf.length) foerste = o;
    buf.push(o ? `${o}\n${t}`.trim() : t);
    if (antallOrd(buf.join(" ")) >= MIN_ORD) {
      ut.push([foerste, buf.join("\n\n")]);
      buf = [];
    }
  }
  if (buf.length) {
    const rest = buf.join("\n\n");
    if (ut.length) ut[ut.length - 1] = [ut[ut.length - 1][0], ut[ut.length - 1][1] + "\n\n" + rest];
    else ut.push([foerste, rest]);
  }
  return ut;
}

function delLange(tekst: string): string[] {
  if (antallOrd(tekst) <= MAKS_ORD) return [tekst];
  const biter: string[] = [];
  let gjeldende: string[] = [];
  let ant = 0;
  for (const a of tekst.split("\n\n")) {
    const n = antallOrd(a);
    if (gjeldende.length && ant + n > MAKS_ORD) {
      biter.push(gjeldende.join("\n\n"));
      gjeldende = [gjeldende[gjeldende.length - 1]];
      ant = antallOrd(gjeldende[0]);
    }
    gjeldende.push(a);
    ant += n;
  }
  biter.push(gjeldende.join("\n\n"));
  return biter;
}

type Meta = { tittel: string; dato: string; url: string };

function lesArtikkel(fil: string, tekst: string): [Meta, string] {
  const a = tekst.indexOf("---\n");
  const b = a < 0 ? -1 : tekst.indexOf("---\n", a + 4);
  if (a < 0 || b < 0) throw new Error(`${fil}: mangler frontmatter`);
  const meta: Record<string, string> = {};
  for (const l of linjer(tekst.slice(a + 4, b).trim())) {
    const i = l.indexOf(": ");
    if (i < 0) throw new Error(`${fil}: ugyldig frontmatter-linje: ${l}`);
    meta[l.slice(0, i)] = l.slice(i + 2);
  }
  for (const k of ["tittel", "dato", "url"]) {
    if (!meta[k]) throw new Error(`${fil}: frontmatter mangler ${k}`);
  }
  return [meta as Meta, tekst.slice(b + 4)];
}

async function mdFiler(mappe: string): Promise<string[]> {
  // Mappen er valgfri: har du bare artikler, trenger du ikke bøker/.
  const navn = (await readdir(mappe).catch(() => [] as string[])).filter((n) => n.endsWith(".md"));
  // Kodepunkt-rekkefølge, ikke localeCompare, så rekkefølgen er lik på alle maskiner.
  return navn.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

async function lagBiter(tekstMappe: string): Promise<Bit[]> {
  const ut: Bit[] = [];
  const kilder = [
    ["artikkel", path.join(tekstMappe, "artikler"), false],
    ["bok", path.join(tekstMappe, "bøker"), true],
  ] as const;
  for (const [kilde, mappe, bok] of kilder) {
    for (const fil of await mdFiler(mappe)) {
      const stamme = fil.slice(0, -3);
      const tekst = await readFile(path.join(mappe, fil), "utf8");
      const [meta, kropp0] = lesArtikkel(fil, tekst);
      const kropp = bok ? rensKursiv(kropp0) : kropp0;
      for (const [o, innhold] of blokker(seksjoner(rensRa(kropp, bok)))) {
        const overskrift = o === meta.tittel ? "" : o;
        for (const bit of delLange(innhold)) {
          ut.push({
            id: `${stamme}#${ut.length}`,
            fil,
            kilde,
            tittel: meta.tittel,
            dato: meta.dato,
            url: meta.url,
            overskrift,
            tekst: bit,
          });
        }
      }
    }
  }
  return ut;
}

// ---------- rensing av biter ----------

const TOC = /^.*(\.{4,}|\/\/\s*s\.\s*\d+|innholdsfortegnelse).*$/gim;
const LINJER = /^(©.*|Denne boka er lisensiert.*|Kontakt:.*)$/gm;

function rens1(t: string, bok: boolean): string {
  t = t.replaceAll("<u>", "").replaceAll("</u>", "").replaceAll("<br>", " ");
  t = t.replace(LINJER, "");
  if (bok) t = t.replace(TOC, "");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

function delSetninger(tekst: string, maks = 400): string[] {
  const biter: string[] = [];
  let gjeldende: string[] = [];
  let ant = 0;
  for (const s of tekst.split(/(?<=[.!?])\s+/)) {
    const n = antallOrd(s);
    if (gjeldende.length && ant + n > maks) {
      biter.push(gjeldende.join(" "));
      gjeldende = [];
      ant = 0;
    }
    gjeldende.push(s);
    ant += n;
  }
  if (gjeldende.length) biter.push(gjeldende.join(" "));
  return biter;
}

function rydd1(biter: Bit[]): Bit[] {
  const ut: Bit[] = [];
  for (const b of biter) {
    const bok = b.kilde === "bok";
    const original = b.tekst;
    b.tekst = rens1(original, bok);
    if (bok && antallOrd(b.tekst) < 40 && b.tekst !== original) continue;
    if (antallOrd(b.tekst) > 450) {
      delSetninger(b.tekst).forEach((del, i) =>
        ut.push({ ...b, id: `${b.id}.${i}`, tekst: del }),
      );
    } else {
      ut.push(b);
    }
  }
  return ut;
}

// ---------- rydd2 ----------

const SPERRET = new RegExp(
  String.raw`(?<!${ORDTEGN})(?:[A-ZÆØÅ] ){3,}[A-ZÆØÅ](?!${ORDTEGN})`,
  "gu",
);

function rens2(t: string): string {
  t = t.replace(/<\/?mark>/g, "");
  t = t.replace(/^\|[-| ]*\|\s*$/gm, "");
  t = t.replace(SPERRET, (m) => m.replaceAll(" ", ""));
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

function rydd2(biter: Bit[]): Bit[] {
  for (const b of biter) {
    b.tekst = rens2(b.tekst);
    b.overskrift = rens2(b.overskrift);
    if (b.kilde === "bok") {
      if (b.overskrift.includes("nnholdsfortegnelse")) b.overskrift = "";
    }
  }
  return biter;
}

// ---------- fjern_kilder ----------

const KILDE_OVERSKRIFT = new RegExp(
  String.raw`^(<u>)?\s*(\d+\s*\.?\s*)?(kilder|kildeliste|litteratur|ressurserogkilder)(?!${ORDTEGN})`,
  "iu",
);

function fjernKilder(biter: Bit[]): Bit[] {
  return biter.filter((b) => {
    if (b.kilde !== "bok") return true;
    const ordtall = Math.max(antallOrd(b.tekst), 1);
    const tetthet = (100 * (b.tekst.split("http").length - 1)) / ordtall;
    const refs = b.tekst.match(/\.\s\(\d{4}/g)?.length ?? 0;
    // Korte litteraturlister med brutte lenker ("htt- ps")
    // slapp gjennom. Den ene biten dette gjelder, var likevel fjernet i dagens data.
    const refTetthet = (100 * refs) / ordtall;
    return !(
      KILDE_OVERSKRIFT.test(b.overskrift) ||
      tetthet >= 4 ||
      refs >= 5 ||
      refTetthet >= 5
    );
  });
}

// ---------- dobbelttreff ----------
// Bøker kan samle artikler som også ligger i tekster/artikler. Bokbiter der mer enn halvparten av ordsekvensene
// (8 ord) også står i en artikkel, fjernes, så søket gir artikkelen med riktig år og lenke.
// Forord, innledninger og annen tekst som bare står i boka, blir med. Skillet er tydelig:
// egne biter ligger under 20 %, gjenbrukte artikler stort sett over 60 %.

const SEKVENS = 8;
const MAKS_DELT = 0.5;

function sekvenser(tekst: string): Set<string> {
  const ordene = tekst.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const ut = new Set<string>();
  for (let i = 0; i + SEKVENS <= ordene.length; i++) ut.add(ordene.slice(i, i + SEKVENS).join(" "));
  return ut;
}

function fjernDobbelttreff(biter: Bit[]): Bit[] {
  const artikler = new Set<string>();
  for (const b of biter) if (b.kilde === "artikkel") sekvenser(b.tekst).forEach((s) => artikler.add(s));
  const fjernet = new Map<string, number>();
  const ut = biter.filter((b) => {
    if (b.kilde !== "bok") return true;
    const egne = sekvenser(b.tekst);
    let delt = 0;
    for (const s of egne) if (artikler.has(s)) delt++;
    if (delt / Math.max(egne.size, 1) <= MAKS_DELT) return true;
    fjernet.set(b.fil, (fjernet.get(b.fil) ?? 0) + 1);
    return false;
  });
  for (const [fil, n] of fjernet) console.log(`  ${n} biter i ${fil} står også som artikkel, utelatt`);
  return ut;
}

// ---------- vektorer og skriving ----------

const embedTekst = (b: Bit) => `${b.tittel}\n${b.overskrift}\n\n${b.tekst}`.trim();

async function lesGamle(utMappe: string, dim: number): Promise<Map<string, Float32Array>> {
  const gamle = new Map<string, Float32Array>();
  let biter: Bit[];
  let bin: Buffer;
  try {
    biter = JSON.parse(await readFile(path.join(utMappe, "biter.json"), "utf8"));
    bin = await readFile(path.join(utMappe, "vektorer.bin"));
  } catch {
    return gamle;
  }
  const v = new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  if (v.length !== biter.length * dim) {
    console.warn("Eksisterende vektorer passer ikke til biter.json, vektoriserer alt på nytt.");
    return gamle;
  }
  biter.forEach((b, i) => gamle.set(embedTekst(b), v.slice(i * dim, (i + 1) * dim)));
  return gamle;
}

// Samme format som JSON med ikke-ASCII-tegn urørt, så uendrede data gir null diff.
function tilJson(biter: Bit[]): string {
  const obj = (b: Bit) =>
    "{" + FELT.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(b[k])}`).join(", ") + "}";
  return "[" + biter.map(obj).join(", ") + "]";
}

async function skrivAtomisk(fil: string, data: string | Uint8Array) {
  await writeFile(`${fil}.tmp`, data);
  await rename(`${fil}.tmp`, fil);
}

function arg(navn: string, standard: string): string {
  const i = process.argv.indexOf(navn);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
}

async function main() {
  const { DIM, embedMange } = await import("@/lib/sok");
  const tekstMappe = path.resolve(arg("--tekster", "tekster"));
  const utMappe = path.resolve(arg("--ut", "data"));
  const bareSjekk = process.argv.includes("--sjekk");

  const biter = fjernDobbelttreff(fjernKilder(rydd2(rydd1(await lagBiter(tekstMappe)))));
  const filer = new Set(biter.map((b) => b.fil));
  console.log(`${biter.length} biter fra ${filer.size} filer i ${path.relative(process.cwd(), tekstMappe) || "."}`);

  const gamle = await lesGamle(utMappe, DIM);
  const tekster = biter.map(embedTekst);
  const mangler = [...new Set(tekster.filter((t) => !gamle.has(t)))];
  const iBruk = new Set(tekster);
  const utgaar = [...gamle.keys()].filter((t) => !iBruk.has(t)).length;
  console.log(`  gjenbrukes: ${biter.length - tekster.filter((t) => !gamle.has(t)).length}`);
  console.log(`  må vektoriseres: ${mangler.length}`);
  console.log(`  utgår: ${utgaar}`);

  if (bareSjekk) {
    const nyeFiler = [...new Set(biter.filter((b) => !gamle.has(embedTekst(b))).map((b) => b.fil))];
    if (nyeFiler.length) console.log(`  filer med nye/endrede biter:\n    ${nyeFiler.join("\n    ")}`);
    return;
  }

  for (let i = 0; i < mangler.length; i += BATCH) {
    const gruppe = mangler.slice(i, i + BATCH);
    const vektorer = await embedMange(gruppe);
    gruppe.forEach((t, j) => gamle.set(t, vektorer[j]));
    console.log(`  vektorisert ${Math.min(i + BATCH, mangler.length)}/${mangler.length}`);
  }

  const alle = new Float32Array(biter.length * DIM);
  tekster.forEach((t, i) => alle.set(gamle.get(t)!, i * DIM));

  await skrivAtomisk(path.join(utMappe, "vektorer.bin"), new Uint8Array(alle.buffer));
  await skrivAtomisk(path.join(utMappe, "biter.json"), tilJson(biter));
  console.log(`Skrev ${path.relative(process.cwd(), utMappe)}/biter.json og vektorer.bin. Start appen og prøv et søk.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
