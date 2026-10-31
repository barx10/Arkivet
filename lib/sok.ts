import { readFile } from "node:fs/promises";
import path from "node:path";
import { geminiPost } from "@/lib/gemini";

export type Bit = {
  id: string;
  fil: string;
  kilde: "artikkel" | "bok";
  tittel: string;
  dato: string;
  url: string;
  overskrift: string;
  tekst: string;
};

export type Treff = Bit & { score: number };

export const DIM = 1536;
const ANTALL = 16;
const MAKS_PER_FIL = 1;
const EMBED_MODELL = "gemini-embedding-2";

type Indeks = { biter: Bit[]; vektorer: Float32Array };

// Lastes én gang per serverprosess og deles mellom forespørsler.
let indeks: Promise<Indeks> | null = null;

function lastIndeks(): Promise<Indeks> {
  if (!indeks) {
    indeks = (async () => {
      const dataDir = path.join(process.cwd(), "data");
      const [json, bin] = await Promise.all([
        readFile(path.join(dataDir, "biter.json"), "utf8"),
        readFile(path.join(dataDir, "vektorer.bin")),
      ]);
      const biter: Bit[] = JSON.parse(json);
      // Kopier til en justert buffer; Node-buffere kan ha vilkårlig byteOffset.
      const vektorer = new Float32Array(
        bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
      );
      if (vektorer.length !== biter.length * DIM) {
        throw new Error(
          `vektorer.bin har ${vektorer.length} tall, forventet ${biter.length * DIM}`,
        );
      }
      return { biter, vektorer };
    })().catch((err) => {
      indeks = null;
      throw err;
    });
  }
  return indeks;
}

export async function embed(tekst: string): Promise<Float32Array> {
  const data = await geminiPost<{ embedding?: { values?: number[] } }>(
    EMBED_MODELL,
    "embedContent",
    {
      content: { parts: [{ text: tekst }] },
      output_dimensionality: DIM,
    },
  );
  return normaliser(data.embedding?.values);
}

// Brukes av indekseringen. Én forespørsel per tekst i batchen, så modellen
// ikke slår flere tekster sammen til én vektor.
export async function embedMange(tekster: string[]): Promise<Float32Array[]> {
  const data = await geminiPost<{ embeddings?: { values?: number[] }[] }>(
    EMBED_MODELL,
    "batchEmbedContents",
    {
      requests: tekster.map((t) => ({
        model: `models/${EMBED_MODELL}`,
        content: { parts: [{ text: t }] },
        output_dimensionality: DIM,
      })),
    },
  );
  if (data.embeddings?.length !== tekster.length) {
    throw new Error("Uventet antall vektorer fra embedding-API");
  }
  return data.embeddings.map((e) => normaliser(e.values));
}

function normaliser(values: number[] | undefined): Float32Array {
  if (!values || values.length !== DIM) {
    throw new Error("Uventet svar fra embedding-API");
  }
  const v = Float32Array.from(values);
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

// Årsfilteret fra forsiden. Begge grensene er med; mangler en, er den åpen.
export type Tidsrom = { fraAar?: number; tilAar?: number };

const heltall = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : undefined);

// Leser fraAar og tilAar fra en forespørsel og ser bort fra alt annet.
export function lesTidsrom(body: { fraAar?: unknown; tilAar?: unknown }): Tidsrom {
  return { fraAar: heltall(body.fraAar), tilAar: heltall(body.tilAar) };
}

export const iTidsrom = (dato: string, { fraAar, tilAar }: Tidsrom) => {
  const aar = Number(dato.slice(0, 4));
  return !(fraAar && aar < fraAar) && !(tilAar && aar > tilAar);
};

// Valg for ett søk. fil avgrenser søket til én tekst: da gjelder ikke årsfilteret
// eller grensen på én bit per tekst, og flere biter fra teksten kan komme med.
export type SokValg = Tidsrom & { antall?: number; fil?: string };

export const ANTALL_EN_TEKST = 12;

// Rangerer bitene mot en normalisert spørsmålsvektor. Ren funksjon, testet i
// scripts/test-sok.ts.
export function velgTreff(
  biter: Bit[],
  vektorer: Float32Array,
  q: Float32Array,
  opts: SokValg = {},
): Treff[] {
  const kandidater: { i: number; score: number }[] = [];
  for (let i = 0; i < biter.length; i++) {
    if (opts.fil ? biter[i].fil !== opts.fil : !iTidsrom(biter[i].dato, opts)) continue;
    const off = i * DIM;
    let s = 0;
    for (let d = 0; d < DIM; d++) s += q[d] * vektorer[off + d];
    kandidater.push({ i, score: s });
  }
  kandidater.sort((a, b) => b.score - a.score);

  const antall = opts.antall ?? (opts.fil ? ANTALL_EN_TEKST : ANTALL);
  const maksPerFil = opts.fil ? antall : MAKS_PER_FIL;
  const perFil = new Map<string, number>();
  const valgt: Treff[] = [];
  for (const { i, score } of kandidater) {
    const bit = biter[i];
    const n = perFil.get(bit.fil) ?? 0;
    if (n >= maksPerFil) continue;
    perFil.set(bit.fil, n + 1);
    valgt.push({ ...bit, score });
    if (valgt.length === antall) break;
  }
  return valgt;
}

export async function sok(sporsmal: string, opts: SokValg = {}): Promise<Treff[]> {
  const [{ biter, vektorer }, q] = await Promise.all([lastIndeks(), embed(sporsmal)]);
  return velgTreff(biter, vektorer, q, opts);
}

// Finnes teksten i indeksen? Brukes for å avvise ukjente filnavn fra nettleseren.
export async function finnesFil(fil: string): Promise<boolean> {
  const { biter } = await lastIndeks();
  return biter.some((b) => b.fil === fil);
}
