import type { CSSProperties } from "react";

const RADER = 11;

// Titlene på alle tekstene, i rader som glir sakte i hver sin retning bak
// splash-siden. Rent pynt; skjult for skjermlesere.
export default function Titler({ titler }: { titler: string[] }) {
  // Fast rekkefølge (ikke tilfeldig), så server og klient gir samme HTML.
  const rader = Array.from({ length: RADER }, (_, r) =>
    titler.filter((_, i) => i % RADER === r).concat(titler.filter((_, i) => (i + r * 7) % RADER === 0)),
  );
  return (
    <div className="titler" aria-hidden="true">
      {rader.map((rad, r) => (
        <div
          key={r}
          className="titler-rad"
          style={{ "--tid": `${160 + ((r * 37) % 90)}s`, "--retning": r % 2 ? "reverse" : "normal" } as CSSProperties}
        >
          {/* To like kopier, så løkken ikke får skjøt. */}
          {[0, 1].map((kopi) => (
            <span key={kopi}>
              {rad.map((t, i) => (
                <span key={i} className="titler-tittel">
                  {t}
                </span>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
