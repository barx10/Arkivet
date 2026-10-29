// Samler tallene til statistikksiden. Rene funksjoner, testet i scripts/test-statistikk.ts.

import type { Vurdering } from "@/lib/lager";

export type Dag = { dag: string; antall: number };
export type Maned = { maned: string; opp: number; ned: number };
export type Kilde = { fil: string; tittel: string; aar: string; opp: number; ned: number };

// De n siste dagene til og med idag (ÅÅÅÅ-MM-DD), eldst først. Dager uten søk gir 0.
export function sisteDager(perDag: Record<string, number>, idag: string, n: number): Dag[] {
  const slutt = Date.parse(`${idag}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const dag = new Date(slutt - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { dag, antall: perDag[dag] ?? 0 };
  });
}

// Tommel opp og ned per måned, eldst først. Måneder uten vurderinger tas med mellom
// første og siste, så aksen ikke hopper over tid.
export function vurderingerPerManed(vurderinger: Vurdering[]): Maned[] {
  const per = new Map<string, Maned>();
  for (const v of vurderinger) {
    const maned = v.tid.slice(0, 7);
    const m = per.get(maned) ?? { maned, opp: 0, ned: 0 };
    m[v.dom]++;
    per.set(maned, m);
  }
  const maneder = [...per.keys()].sort();
  if (!maneder.length) return [];
  const ut: Maned[] = [];
  let [aar, mnd] = maneder[0].split("-").map(Number);
  for (;;) {
    const maned = `${aar}-${String(mnd).padStart(2, "0")}`;
    ut.push(per.get(maned) ?? { maned, opp: 0, ned: 0 });
    if (maned >= maneder[maneder.length - 1]) return ut;
    if (++mnd > 12) [aar, mnd] = [aar + 1, 1];
  }
}

// Tekstene som oftest er brukt som kilde i vurderte svar, med fordelingen opp/ned.
export function kilderIVurderinger(vurderinger: Vurdering[], antall: number): Kilde[] {
  const per = new Map<string, Kilde>();
  for (const v of vurderinger) {
    for (const k of new Map(v.kilder.map((k) => [k.fil, k])).values()) {
      const kilde = per.get(k.fil) ?? { fil: k.fil, tittel: k.tittel, aar: k.dato.slice(0, 4), opp: 0, ned: 0 };
      kilde[v.dom]++;
      per.set(k.fil, kilde);
    }
  }
  return [...per.values()]
    .sort((a, b) => b.opp + b.ned - (a.opp + a.ned) || b.ned - a.ned || a.tittel.localeCompare(b.tittel, "nb"))
    .slice(0, antall);
}
