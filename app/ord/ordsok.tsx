"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Tekst } from "@/lib/ordsok";
import TemaBryter from "../tema";

export default function Ordsok() {
  const router = useRouter();
  const [uttrykk, setUttrykk] = useState("");
  const [sokt, setSokt] = useState("");
  const [tekster, setTekster] = useState<Tekst[] | null>(null);
  const [status, setStatus] = useState<"klar" | "venter" | "feil">("klar");
  const [feil, setFeil] = useState("");

  async function sok(e: React.FormEvent) {
    e.preventDefault();
    const q = uttrykk.trim();
    if (!q || status === "venter") return;
    setStatus("venter");
    try {
      const res = await fetch("/api/ord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uttrykk: q }),
      });
      if (res.status === 401) {
        router.push("/logginn");
        return;
      }
      const data: { tekster?: Tekst[]; feil?: string } = await res.json();
      if (!res.ok || !data.tekster) throw new Error(data.feil ?? "Noe gikk galt");
      setTekster(data.tekster);
      setSokt(q);
      setStatus("klar");
    } catch (err) {
      setFeil(err instanceof TypeError ? "Fikk ikke kontakt med serveren" : (err as Error).message);
      setStatus("feil");
    }
  }

  const totalt = tekster?.reduce((sum, t) => sum + t.antall, 0) ?? 0;

  return (
    <div className="ramme">
      <header className="topp">
        <h1 className="ordmerke">
          <Link href="/">Arkivet</Link>
        </h1>
        <div className="topp-hoyre">
          <Link href="/">Samtale</Link>
          <TemaBryter />
        </div>
      </header>

      <main className="ordsok">
        <p className="intro-tittel">Ordsøk</p>
        <p className="intro-tekst">
          Finner et ord eller uttrykk slik det står i tekstene. Skriv * på slutten for å få med alle
          ord som begynner slik, for eksempel mobil*.
        </p>
        <form className="skjema" onSubmit={sok}>
          <div className="skjema-rad">
            <input
              aria-label="Ord eller uttrykk"
              placeholder="Ord eller uttrykk"
              autoFocus
              maxLength={200}
              value={uttrykk}
              onChange={(e) => setUttrykk(e.target.value)}
            />
            <button type="submit" className="primar" disabled={status === "venter" || !uttrykk.trim()}>
              {status === "venter" ? "Søker …" : "Søk"}
            </button>
          </div>
        </form>

        {status === "feil" && <p className="feil">{feil}</p>}
        {tekster && (
          <p className="meta ordsok-sum" aria-live="polite">
            {tekster.length === 0
              ? `Fant ikke «${sokt}» i tekstene.`
              : `«${sokt}» står ${totalt} ${totalt === 1 ? "gang" : "ganger"} i ${tekster.length} ${
                  tekster.length === 1 ? "tekst" : "tekster"
                }, fra ${tekster[0].dato.slice(0, 4)} til ${tekster[tekster.length - 1].dato.slice(0, 4)}.`}
          </p>
        )}
        <ol className="ordsok-liste">
          {tekster?.map((t) => (
            <li key={t.fil} className="ordsok-tekst">
              <a className="kilde-tittel" href={t.url} target="_blank" rel="noreferrer">
                {t.tittel}
              </a>
              <p className="meta">
                {t.kilde === "bok" ? "Bok" : "Artikkel"}, {t.dato.slice(0, 4)} · {t.antall} treff
                {t.antall > t.funn.length && `, viser ${t.funn.length}`}
              </p>
              {t.funn.map((f, i) => (
                <p key={i} className="ordsok-funn">
                  {f.overskrift && <span className="meta">{f.overskrift}: </span>}
                  {f.for}
                  <mark>{f.ord}</mark>
                  {f.etter}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
