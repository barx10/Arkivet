import type { Kilde } from "@/lib/svar";

// Øktarkivet: de siste samtalene, lagret i nettleseren så de overlever at fanen lukkes.
// Ingenting sendes til serveren. Rene funksjoner, så de kan testes uten nettleser.
// Turene lagres slik samtalen har dem; typen eies av app/samtale.tsx.

export const LAGRING_OKTER = "bloggbot-okter-v1";
export const MAKS_OKTER = 10;

export type Okt<T> = { id: string; endret: number; turer: T[]; kilder: Kilde[] };

type Lagret<T> = { versjon: 1; okter: Okt<T>[] };

export function lesOkter<T>(raa: string | null): Okt<T>[] {
  try {
    const lagret = JSON.parse(raa || "null") as Lagret<T> | null;
    return lagret?.versjon === 1 && Array.isArray(lagret.okter) ? lagret.okter : [];
  } catch {
    return [];
  }
}

export const skrivOkter = <T>(okter: Okt<T>[]) => JSON.stringify({ versjon: 1, okter } satisfies Lagret<T>);

// Økten legges øverst, og en eldre versjon av den samme fjernes. Den eldste faller ut.
export function leggTil<T>(okter: Okt<T>[], okt: Okt<T>, maks = MAKS_OKTER): Okt<T>[] {
  return [okt, ...okter.filter((o) => o.id !== okt.id)].slice(0, maks);
}
