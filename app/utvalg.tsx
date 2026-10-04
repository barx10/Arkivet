"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { filnavn, forbered, LAGRING_UTVALG, lesUtvalg, skrivUtvalg, type Del, type TurDel } from "@/lib/utvalg";

// Utvalget lagres i localStorage, så det overlever at fanen lukkes og kan vokse over
// flere samtaler. Leses etter første render, som samtalen.
export function useUtvalg() {
  const [deler, setDeler] = useState<Del[]>([]);
  const [lastet, setLastet] = useState(false);
  const [feil, setFeil] = useState(false);

  useEffect(() => {
    // Engangslasting fra localStorage etter hydrering; kan ikke gjøres under render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeler(lesUtvalg(localStorage.getItem(LAGRING_UTVALG)));
    setLastet(true);
  }, []);

  useEffect(() => {
    if (!lastet) return;
    try {
      localStorage.setItem(LAGRING_UTVALG, skrivUtvalg(deler));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeil(false);
    } catch {
      setFeil(true);
    }
  }, [deler, lastet]);

  const har = useCallback((id: string) => deler.some((d) => d.id === id), [deler]);
  const veksle = useCallback(
    (d: Del) => setDeler((ds) => (ds.some((x) => x.id === d.id) ? ds.filter((x) => x.id !== d.id) : [...ds, d])),
    [],
  );
  const fjern = useCallback((id: string) => setDeler((ds) => ds.filter((d) => d.id !== id)), []);
  const tom = useCallback(() => setDeler([]), []);
  // Turer som er tatt med, får sitater og forslag som kommer etterpå.
  const oppfrisk = useCallback((turer: TurDel[]) => {
    setDeler((ds) => {
      let endret = false;
      const nye = ds.map((d) => {
        const ny = turer.find((t) => t.id === d.id);
        if (!ny || JSON.stringify(ny) === JSON.stringify(d)) return d;
        endret = true;
        return ny;
      });
      return endret ? nye : ds;
    });
  }, []);

  return { deler, feil, har, veksle, fjern, tom, oppfrisk };
}

export type Utvalg = ReturnType<typeof useUtvalg>;

const etikett = (d: Del) =>
  d.type === "tur"
    ? d.sporsmal.charAt(0).toUpperCase() + d.sporsmal.slice(1)
    : `«${d.tekst.length > 60 ? `${d.tekst.slice(0, 60).trimEnd()} …` : d.tekst}» (${d.kilde.tittel})`;

// «Utvalg (n)» med liste, tittel, nedlasting og tømming. Uten utvalg: «Last ned økten»,
// som åpner det samme panelet med bare tittelfeltet.
export function UtvalgKnapp({ utvalg, okt }: { utvalg: Utvalg; okt: () => Del[] }) {
  const [apen, setApen] = useState(false);
  const [tittel, setTittel] = useState("");
  const [status, setStatus] = useState<"" | "lager" | "tomme" | "feil">("");
  const boks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apen) return;
    const lukk = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !boks.current?.contains(e.target as Node)) setApen(false);
    };
    document.addEventListener("mousedown", lukk);
    document.addEventListener("keydown", lukk);
    return () => {
      document.removeEventListener("mousedown", lukk);
      document.removeEventListener("keydown", lukk);
    };
  }, [apen]);

  const erOkt = !utvalg.deler.length;
  const standard = erOkt ? "Økt i Arkivet" : "Utvalg fra Arkivet";

  async function lastNed(e: React.FormEvent) {
    e.preventDefault();
    const deler = erOkt ? okt() : utvalg.deler;
    if (!deler.length) return;
    setStatus("lager");
    try {
      const { tilBlob } = await import("@/lib/dokument");
      const dato = new Date();
      const navn = tittel.trim() || standard;
      const blob = await tilBlob(forbered(deler), { tittel: navn, dato });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filnavn(navn, dato);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (erOkt) setApen(false);
      setStatus(erOkt ? "" : "tomme");
    } catch {
      setStatus("feil");
    }
  }

  if (erOkt && !okt().length) return null;

  return (
    <div className="utvalg" ref={boks}>
      <button type="button" className="lenkeknapp" aria-expanded={apen} onClick={() => setApen((a) => !a)}>
        {erOkt ? "Last ned økten" : `Utvalg (${utvalg.deler.length})`}
      </button>
      {apen && (
        <div className="utvalg-panel">
          {utvalg.feil && <p className="feil">Kunne ikke lagre utvalget</p>}
          {!erOkt && (
            <ol>
              {utvalg.deler.map((d) => (
                <li key={d.id}>
                  <span>{etikett(d)}</span>
                  <button type="button" className="lenkeknapp" onClick={() => utvalg.fjern(d.id)}>
                    Fjern
                  </button>
                </li>
              ))}
            </ol>
          )}
          {status === "tomme" ? (
            <p className="utvalg-handlinger">
              Tømme utvalget?{" "}
              <button type="button" className="liten" onClick={() => { utvalg.tom(); setStatus(""); setApen(false); }}>
                Tøm
              </button>
              <button type="button" className="lenkeknapp" onClick={() => setStatus("")}>
                Behold
              </button>
            </p>
          ) : (
            <form className="utvalg-handlinger" onSubmit={lastNed}>
              <label className="utvalg-tittel">
                Tittel og filnavn
                <input value={tittel} placeholder={standard} onChange={(e) => setTittel(e.target.value)} />
              </label>
              <button type="submit" className="liten" disabled={status === "lager"}>
                {status === "lager" ? "Lager …" : "Last ned .docx"}
              </button>
              {!erOkt && (
                <button type="button" className="lenkeknapp" onClick={utvalg.tom}>
                  Tøm
                </button>
              )}
            </form>
          )}
          {status === "feil" && <p className="feil">Kunne ikke lage dokumentet. Utvalget er urørt.</p>}
        </div>
      )}
    </div>
  );
}
