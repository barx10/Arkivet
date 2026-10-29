// Oppdiktede søk og vurderinger til statistikksiden når lagringen ikke er satt opp,
// så siden kan vises fram uten Redis. Tallene er faste for en gitt dag og bygger på
// titlene i arkivet, så kildene finnes. Siden merker dem tydelig som eksempeldata.

import type { ArkivTekst } from "@/lib/arkiv";
import type { SokStatistikk, Vurdering } from "@/lib/lager";

const GENERELLE = [
  "Hva mener jeg om skjermtid?",
  "Hvordan har synet mitt på skriving endret seg?",
  "Hva har jeg skrevet om å ta pauser?",
  "Hvilke argumenter har jeg brukt om langsomhet?",
  "Hva skriver jeg om lesing?",
];

// Enkel tallgenerator med fast startverdi, så tallene ikke endrer seg ved hver visning.
function tilfeldig(frø: number) {
  let s = frø >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function eksempelStatistikk(
  tekster: ArkivTekst[],
  idag: string,
  antall: number,
): { sok: SokStatistikk; vurderinger: Vurdering[] } {
  const r = tilfeldig(Number(idag.replaceAll("-", "")));
  const slutt = Date.parse(`${idag}T12:00:00Z`);
  const dag = (n: number) => new Date(slutt - n * 86_400_000).toISOString().slice(0, 10);

  const perDag: Record<string, number> = {};
  for (let i = 0; i < 45; i++) {
    // Færre søk i helgene.
    const helg = [0, 6].includes(new Date(slutt - i * 86_400_000).getUTCDay());
    const n = Math.floor(r() * (helg ? 4 : 11));
    if (n) perDag[dag(i)] = n;
  }

  const sporsmal = [
    ...tekster.slice(0, 6).map((t) => `Hva har jeg skrevet om ${t.tittel.toLowerCase()}?`),
    ...GENERELLE,
  ];
  const mest = sporsmal
    .map((tekst, i) => ({ tekst, antall: Math.max(1, Math.round(18 / (i + 1) + r() * 3)) }))
    .sort((a, b) => b.antall - a.antall);

  const vurderinger: Vurdering[] = [];
  for (let i = 0; i < 46; i++) {
    const kilder = [...tekster]
      .sort(() => r() - 0.5)
      .slice(0, 1 + Math.floor(r() * 3))
      .map(({ fil, tittel, dato }) => ({ fil, tittel, dato }));
    vurderinger.push({
      tid: `${dag(Math.floor(r() * 150))}T12:00:00Z`,
      dom: r() < 0.82 ? "opp" : "ned",
      sporsmal: sporsmal[i % sporsmal.length],
      svar: "",
      tidligere: [],
      kilder,
    });
  }

  return {
    sok: {
      totalt: mest.reduce((s, m) => s + m.antall, 0) + Object.values(perDag).reduce((s, n) => s + n, 0),
      ulike: sporsmal.length + 23,
      mest: mest.slice(0, antall),
      perDag,
    },
    vurderinger,
  };
}
