"use client";

import { useEffect, useState } from "react";
import type { ArkivTekst } from "@/lib/arkiv";
import { Soyler } from "./diagram";

// Tallet teller opp fra 0 når siden lastes, med mindre brukeren har bedt om
// mindre bevegelse. Serveren tegner det ferdige tallet.
export function Opptelling({ verdi }: { verdi: number }) {
  const [vist, setVist] = useState(verdi);

  useEffect(() => {
    if (!verdi || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let ramme = 0;
    const steg = (na: number) => {
      const t = Math.min(1, (na - start) / 900);
      setVist(Math.round(verdi * (1 - (1 - t) ** 3)));
      if (t < 1) ramme = requestAnimationFrame(steg);
    };
    ramme = requestAnimationFrame(steg);
    return () => cancelAnimationFrame(ramme);
  }, [verdi]);

  return <>{vist.toLocaleString("nb-NO")}</>;
}

const MANEDER = ["jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."];
const datoTekst = (dato: string) =>
  dato.length >= 10 ? `${Number(dato.slice(8, 10))}. ${MANEDER[Number(dato.slice(5, 7)) - 1]}` : "";

// Tekster per år. Et klikk på en søyle viser tekstene fra det året; det siste året
// er valgt fra start.
export function Aarsvelger({ tekster }: { tekster: ArkivTekst[] }) {
  const aar = [...new Set(tekster.map((t) => t.dato.slice(0, 4)))].sort();
  const [valgt, setValgt] = useState(aar.length - 1);
  const valgte = tekster.filter((t) => t.dato.startsWith(aar[valgt]));
  const boker = valgte.filter((t) => t.kilde === "bok").length;

  return (
    <>
      <Soyler
        soyler={aar.map((a) => ({ etikett: a, kort: a.slice(2), opp: tekster.filter((t) => t.dato.startsWith(a)).length }))}
        enhet="tekster"
        aksetekst={aar.map((_, i) => i)}
        valgt={valgt}
        velg={setValgt}
      />
      {valgte.length > 0 && (
        <div className="aarsliste" key={aar[valgt]}>
          <p className="aarsliste-tittel">
            <strong>{aar[valgt]}</strong> · {valgte.length - boker} {valgte.length - boker === 1 ? "artikkel" : "artikler"}
            {boker > 0 && `, ${boker} ${boker === 1 ? "bok" : "bøker"}`}
          </p>
          <ul>
            {valgte.map((t) => (
              <li key={t.fil}>
                <span className="aarsliste-dato">{t.kilde === "bok" ? <span className="merkelapp">Bok</span> : datoTekst(t.dato)}</span>
                <a href={t.url} target="_blank" rel="noreferrer">
                  {t.tittel}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
