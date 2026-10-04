"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import type { Arkiv } from "@/lib/arkiv";
import TemaBryter from "../tema";
import Titler from "../titler";

export default function Skjema({
  aar,
  titler,
  innlogget,
}: {
  aar: Arkiv["aar"];
  titler: Arkiv["titler"];
  innlogget: boolean;
}) {
  const router = useRouter();
  const [passord, setPassord] = useState("");
  const [feil, setFeil] = useState("");
  const [venter, setVenter] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setVenter(true);
    setFeil("");
    const res = await fetch("/api/logginn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passord }),
    });
    if (res.ok) {
      router.push("/");
      return;
    }
    const data: { feil?: string } = await res.json().catch(() => ({}));
    setFeil(data.feil ?? "Innlogging feilet");
    setVenter(false);
  }

  const maks = Math.max(1, ...aar.map((a) => a.antall));
  const fra = aar[0]?.aar;
  const til = aar[aar.length - 1]?.aar;

  // Splash: søylene for hvert år vokser fram fra venstre, så kommer navnet og
  // passordfeltet. Alt er CSS, styrt av --i (rekkefølge) og --hoyde.
  return (
    <main className="logginn">
      <Titler titler={titler} />
      <TemaBryter />
      <div className="splash" aria-hidden="true">
        {aar.map((a, i) => (
          <span key={a.aar} style={{ "--i": i, "--hoyde": a.antall / maks } as CSSProperties} />
        ))}
      </div>
      <p className="splash-aar" aria-hidden="true">
        <span>{fra}</span>
        <span>{til}</span>
      </p>
      <h1 className="ordmerke">Arkivet</h1>
      {innlogget ? (
        <Link href="/" className="primar inngang">
          Spør i tekstene
        </Link>
      ) : (
        <form className="skjema" onSubmit={send}>
          <input
            type="password"
            placeholder="Passord"
            aria-label="Passord"
            autoFocus
            autoComplete="current-password"
            value={passord}
            onChange={(e) => setPassord(e.target.value)}
          />
          <div className="skjema-bunn">
            <span className="feil" role="alert">
              {feil}
            </span>
            <button type="submit" className="primar" disabled={venter || !passord}>
              Logg inn
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
