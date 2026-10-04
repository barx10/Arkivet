import { readFile } from "node:fs/promises";
import path from "node:path";

export type Arkiv = {
  aar: { aar: number; antall: number }[];
  artikler: number;
  boker: number;
  titler: string[];
};

// Oversikt over tekstene, hentet ved bygging, siden sidene er statiske.
export async function hentArkiv(): Promise<Arkiv> {
  const json = await readFile(path.join(process.cwd(), "data", "biter.json"), "utf8");
  const biter: { fil: string; tittel: string; dato: string; kilde: "artikkel" | "bok" }[] =
    JSON.parse(json);
  const tekster = new Map(biter.map((b) => [b.fil, b]));
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
