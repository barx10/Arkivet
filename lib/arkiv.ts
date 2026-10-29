import { readFile } from "node:fs/promises";
import path from "node:path";

export type Arkiv = {
  aar: { aar: number; antall: number }[];
  artikler: number;
  boker: number;
  titler: string[];
};

export type ArkivTekst = { fil: string; tittel: string; dato: string; url: string; kilde: "artikkel" | "bok" };

// Én oppføring per tekst, i samme rekkefølge som i biter.json.
async function lesTekster(): Promise<Map<string, ArkivTekst>> {
  const json = await readFile(path.join(process.cwd(), "data", "biter.json"), "utf8");
  const biter: ArkivTekst[] = JSON.parse(json);
  return new Map(biter.map(({ fil, tittel, dato, url, kilde }) => [fil, { fil, tittel, dato, url, kilde }]));
}

// Alle tekstene, nyeste først. Brukes av statistikksiden.
export async function hentTekster(): Promise<ArkivTekst[]> {
  return [...(await lesTekster()).values()].sort((a, b) => b.dato.localeCompare(a.dato));
}

// Oversikt over tekstene, hentet ved bygging, siden sidene er statiske.
export async function hentArkiv(): Promise<Arkiv> {
  const tekster = await lesTekster();
  const perAar = new Map<number, number>();
  let boker = 0;
  for (const t of tekster.values()) {
    const aar = Number(t.dato.slice(0, 4));
    perAar.set(aar, (perAar.get(aar) ?? 0) + 1);
    if (t.kilde === "bok") boker++;
  }
  return {
    aar: [...perAar].sort((a, b) => a[0] - b[0]).map(([aar, antall]) => ({ aar, antall })),
    artikler: tekster.size - boker,
    boker,
    titler: [...tekster.values()].map((t) => t.tittel),
  };
}
