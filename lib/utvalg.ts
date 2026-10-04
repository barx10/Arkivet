import { delSvar } from "@/lib/bakgrunn";
import type { Kilde } from "@/lib/svar";
import type { Punkt } from "@/lib/videre";

// Utvalget: det forfatteren plukker ut for å jobbe videre med, lagret i nettleseren på
// tvers av samtaler. Hver del er en selvstendig kopi, ikke en peker til samtalen, som
// bare lever i fanen. Rene funksjoner, så de kan testes uten nettleser.

export const LAGRING_UTVALG = "bloggbot-utvalg-v1";

// Delt av Arbeid videre i appen og i dokumentet.
export const BOLKNAVN: Record<Punkt["bolk"], string> = {
  fortsettelse: "Mulige fortsettelser",
  perspektiv: "Andre perspektiver",
  ide: "Ideer til nye artikler",
};

export type KildeRef = { tittel: string; dato: string; url: string };

export type TurDel = {
  type: "tur";
  id: string;
  sporsmal: string;
  sok?: string;
  svar: string;
  bakgrunn: string;
  generelt?: string;
  sitater: { sitat: string; kilde: KildeRef }[];
  videre: Punkt[];
  // Samtalens kildenumre som svaret og Arbeid videre viser til.
  kilder: Record<number, KildeRef>;
};

export type BitDel = {
  type: "sitat" | "utdrag";
  id: string;
  tekst: string;
  overskrift?: string;
  kilde: KildeRef;
};

export type Del = TurDel | BitDel;

type Lagret = { versjon: 1; deler: Del[] };

export function lesUtvalg(raa: string | null): Del[] {
  try {
    const lagret = JSON.parse(raa || "null") as Lagret | null;
    return lagret?.versjon === 1 && Array.isArray(lagret.deler) ? lagret.deler : [];
  } catch {
    return [];
  }
}

export const skrivUtvalg = (deler: Del[]) => JSON.stringify({ versjon: 1, deler } satisfies Lagret);

// Turen slik samtalen har den. Bare ferdige sitater, forslag og generell kunnskap tas med.
export type TurInn = {
  sporsmal: string;
  sok?: string;
  svar: string;
  sitater?: { status: string; liste: (KildeRef & { sitat: string })[] };
  videre?: { status: string; punkter: Punkt[] };
  generelt?: { status: string; tekst: string };
};

const HENVISNING = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

const numreI = (tekst: string) =>
  [...tekst.matchAll(HENVISNING)].flatMap((m) => m[1].split(",").map(Number));

const ref = (k: KildeRef): KildeRef => ({ tittel: k.tittel, dato: k.dato, url: k.url });

// Svaret endres ikke etter at turen er ferdig, så spørsmål og svar identifiserer turen.
export const turId = (t: { sporsmal: string; svar: string }) => `tur:${t.sporsmal}\n${t.svar}`;

export function turTilDel(t: TurInn, kilder: Kilde[]): TurDel {
  const { svar, bakgrunn } = delSvar(t.svar);
  const videre = t.videre?.status === "ferdig" ? t.videre.punkter : [];
  const brukte = new Set([...numreI(svar), ...videre.flatMap((p) => p.kilder)]);
  return {
    type: "tur",
    id: turId(t),
    sporsmal: t.sporsmal,
    sok: t.sok,
    svar,
    bakgrunn,
    generelt: t.generelt?.status === "ferdig" ? t.generelt.tekst : undefined,
    sitater:
      t.sitater?.status === "ferdig" ? t.sitater.liste.map((s) => ({ sitat: s.sitat, kilde: ref(s) })) : [],
    videre,
    kilder: Object.fromEntries(kilder.filter((k) => brukte.has(k.nr)).map((k) => [k.nr, ref(k)])),
  };
}

export function bitDel(type: BitDel["type"], tekst: string, kilde: KildeRef, overskrift?: string): BitDel {
  const rent = tekst.trim();
  return { type, id: `${type}:${kilde.url}\n${rent}`, tekst: rent, overskrift: overskrift || undefined, kilde: ref(kilde) };
}

// Klart for dokumentet: turer og festede deler med kildenumre fra én felles liste.
export type FerdigTur = Omit<TurDel, "kilder" | "sitater"> & {
  sitater: { sitat: string; kilde: KildeRef; nr: number }[];
};
export type FerdigBit = BitDel & { nr: number };
export type Ferdig = { turer: FerdigTur[]; biter: FerdigBit[]; kilder: KildeRef[] };

const nokkel = (k: KildeRef) => `${k.url}\n${k.tittel}`;

// Hver tekst får nummer etter første forekomst i dokumentet: turene i rekkefølge
// (svar, sitater, Arbeid videre), deretter festede deler. Ukjente numre fjernes.
export function forbered(deler: Del[]): Ferdig {
  const kilder: KildeRef[] = [];
  const numre = new Map<string, number>();
  const nummer = (k: KildeRef) => {
    const n = nokkel(k);
    if (!numre.has(n)) {
      kilder.push(ref(k));
      numre.set(n, kilder.length);
    }
    return numre.get(n)!;
  };

  const turer = deler
    .filter((d): d is TurDel => d.type === "tur")
    .map(({ kilder: gamle, ...t }): FerdigTur => {
      const ny = (n: number) => (gamle[n] ? nummer(gamle[n]) : undefined);
      const svar = t.svar.replace(/(\s*)\[(\d+(?:\s*,\s*\d+)*)\]/g, (_m, mellomrom: string, liste: string) => {
        const nye = [...new Set(liste.split(",").map((s) => ny(Number(s))))].filter((n) => n !== undefined);
        return nye.length ? `${mellomrom}[${nye.join(", ")}]` : "";
      });
      const sitater = t.sitater.map((s) => ({ ...s, nr: nummer(s.kilde) }));
      const videre = t.videre.map((p) => ({
        ...p,
        kilder: p.kilder.map(ny).filter((n): n is number => n !== undefined),
      }));
      return { ...t, svar, sitater, videre };
    });

  const biter = deler
    .filter((d): d is BitDel => d.type !== "tur")
    .map((b) => ({ ...b, nr: nummer(b.kilde) }));

  return { turer, biter, kilder };
}

// Tittelen fra brukeren, uten tegn som ikke tåles i filnavn. sv-SE gir ÅÅÅÅ-MM-DD i lokal tid.
export function filnavn(tittel: string, dato: Date) {
  const rent = tittel.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return `${rent || "Arkivet"} ${dato.toLocaleDateString("sv-SE")}.docx`;
}
