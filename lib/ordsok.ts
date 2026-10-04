// Ordsøk: finner et ord eller uttrykk slik det står i tekstene, uten språkmodell.
// Et supplement til vektorsøket, ikke en del av det (se SPESIFIKASJON.md).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Bit } from "@/lib/sok";

export type Funn = { overskrift: string; for: string; ord: string; etter: string };

export type Tekst = Pick<Bit, "fil" | "kilde" | "tittel" | "dato" | "url"> & {
  antall: number;
  funn: Funn[];
};

export const MIN_LENGDE = 2;
const MAKS_FUNN = 3;
const KONTEKST = 90;

// Bitene overlapper: starten av en bit gjentar slutten av forrige bit fra samme tekst.
// fra = hvor i biten det nye begynner, så ingen forekomst telles to ganger.
type Del = Bit & { fra: number };

let deler: Promise<Del[]> | null = null;

export function utenOverlapp(biter: Bit[]): Del[] {
  return biter.map((b, i) => {
    const forrige = biter[i - 1];
    if (forrige?.fil !== b.fil) return { ...b, fra: 0 };
    // Den lengste slutten av forrige bit som også er starten på denne.
    const probe = b.tekst.slice(0, 20);
    for (let s = forrige.tekst.indexOf(probe); s >= 0; s = forrige.tekst.indexOf(probe, s + 1)) {
      if (b.tekst.startsWith(forrige.tekst.slice(s))) return { ...b, fra: forrige.tekst.length - s };
    }
    return { ...b, fra: 0 };
  });
}

function lastDeler(): Promise<Del[]> {
  if (!deler) {
    deler = readFile(path.join(process.cwd(), "data", "biter.json"), "utf8")
      .then((json) => utenOverlapp(JSON.parse(json)))
      .catch((err) => {
        deler = null;
        throw err;
      });
  }
  return deler;
}

// Hele ord, uavhengig av store og små bokstaver. * på slutten gir alle ord som
// begynner slik («mobil*» finner mobilen, mobilforbud).
export function monster(uttrykk: string): RegExp | null {
  const prefiks = uttrykk.trim().endsWith("*");
  const ord = uttrykk.trim().replace(/\*+$/, "").trim();
  if (ord.length < MIN_LENGDE) return null;
  const kjerne = ord
    .split(/\s+/)
    .map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${kjerne}${prefiks ? "[\\p{L}\\p{N}]*" : "(?![\\p{L}\\p{N}])"}`, "giu");
}

const flat = (s: string) => s.replace(/\s+/g, " ");

// Kutter ved et mellomrom, så utdraget ikke begynner eller slutter midt i et ord.
function utsnitt(tekst: string, start: number, slutt: number): Omit<Funn, "overskrift"> {
  const a = Math.max(0, start - KONTEKST);
  const b = Math.min(tekst.length, slutt + KONTEKST);
  let forTekst = tekst.slice(a, start);
  let etter = tekst.slice(slutt, b);
  if (a > 0) forTekst = `… ${forTekst.slice(forTekst.indexOf(" ") + 1)}`;
  if (b < tekst.length && etter.lastIndexOf(" ") > 0) etter = `${etter.slice(0, etter.lastIndexOf(" "))} …`;
  return { for: flat(forTekst), ord: flat(tekst.slice(start, slutt)), etter: flat(etter) };
}

export function finn(alle: Del[], uttrykk: string): Tekst[] {
  const re = monster(uttrykk);
  if (!re) return [];
  const perFil = new Map<string, Tekst>();
  for (const d of alle) {
    for (const m of d.tekst.matchAll(re)) {
      if (m.index < d.fra) continue;
      let t = perFil.get(d.fil);
      if (!t) {
        t = { fil: d.fil, kilde: d.kilde, tittel: d.tittel, dato: d.dato, url: d.url, antall: 0, funn: [] };
        perFil.set(d.fil, t);
      }
      t.antall++;
      if (t.funn.length < MAKS_FUNN) {
        t.funn.push({ ...utsnitt(d.tekst, m.index, m.index + m[0].length), overskrift: d.overskrift });
      }
    }
  }
  // Eldst først, så det går fram når uttrykket dukket opp.
  return [...perFil.values()].sort((a, b) => a.dato.localeCompare(b.dato));
}

export async function ordsok(uttrykk: string): Promise<Tekst[]> {
  return finn(await lastDeler(), uttrykk);
}
