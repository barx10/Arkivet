// Enkle diagrammer i HTML og CSS. Verdien vises i en boble ved pekeren (data-tips)
// og leses opp av skjermleser (aria-label). Søylediagrammene har i tillegg en tabell
// som kan klappes ut. Søyler og stolper vokser fram når siden lastes.

import type { CSSProperties } from "react";

const tall = (n: number) => n.toLocaleString("nb-NO");
const stil = (s: Record<string, string | number>) => s as CSSProperties;

export function Forklaring() {
  return (
    <p className="forklaring">
      <span><i className="farge-opp" /> Tommel opp</span>
      <span><i className="farge-ned" /> Tommel ned</span>
    </p>
  );
}

// Små søyler uten akse, til nøkkeltallene.
export function Minisoyler({ verdier }: { verdier: number[] }) {
  const maks = Math.max(1, ...verdier);
  return (
    <div className="minisoyler" aria-hidden="true">
      {verdier.map((v, i) => (
        <span key={i} style={stil({ height: `${Math.max(v ? 8 : 0, (v / maks) * 100)}%`, "--i": i })} />
      ))}
    </div>
  );
}

// Fordelingen opp/ned som én delt stripe, til nøkkeltallene.
export function Fordeling({ opp, ned }: { opp: number; ned: number }) {
  return (
    <div className="fordeling" aria-hidden="true">
      {opp > 0 && <span className="farge-opp" style={{ flexGrow: opp }} />}
      {ned > 0 && <span className="farge-ned" style={{ flexGrow: ned }} />}
    </div>
  );
}

type Soyle = { etikett: string; kort: string; opp: number; ned?: number };

// Loddrette søyler. Med ned stables tommel ned over tommel opp. Med velg blir
// søylene knapper, og den valgte framheves.
export function Soyler({
  soyler,
  enhet,
  aksetekst,
  valgt,
  velg,
}: {
  soyler: Soyle[];
  enhet: string;
  aksetekst: number[];
  valgt?: number;
  velg?: (i: number) => void;
}) {
  const maks = Math.max(1, ...soyler.map((s) => s.opp + (s.ned ?? 0)));
  const stablet = soyler.some((s) => s.ned !== undefined);
  const kolonner = stil({ "--antall": soyler.length });
  return (
    <>
      <div className={`soyler${velg ? " velgbar" : ""}${valgt !== undefined ? " har-valgt" : ""}`} style={kolonner}>
        <span className="soyler-maks">{tall(maks)}</span>
        {soyler.map((s, i) => {
          const sum = s.opp + (s.ned ?? 0);
          const tekst = stablet
            ? `${s.etikett}: ${tall(s.opp)} opp, ${tall(s.ned ?? 0)} ned`
            : `${s.etikett}: ${tall(s.opp)} ${enhet}`;
          // Boblene ved kantene legges innover, så de ikke går ut av diagrammet.
          const kant = i < soyler.length * 0.15 ? " venstre" : i >= soyler.length * 0.85 ? " hoyre" : "";
          const innhold = sum > 0 && (
            <span className="soyle-fyll" style={stil({ height: `${(sum / maks) * 100}%`, "--i": i })}>
              {!!s.ned && <span className="farge-ned" style={{ flexGrow: s.ned }} />}
              {s.opp > 0 && <span className="farge-opp" style={{ flexGrow: s.opp }} />}
            </span>
          );
          return velg ? (
            <button
              key={s.etikett}
              type="button"
              className={`soyle${kant}`}
              data-tips={tekst}
              aria-label={tekst}
              aria-pressed={valgt === i}
              onClick={() => velg(i)}
            >
              {innhold}
            </button>
          ) : (
            <div key={s.etikett} className={`soyle${kant}`} data-tips={tekst} aria-label={tekst} role="img">
              {innhold}
            </div>
          );
        })}
      </div>
      <div className="soyler-akse" style={kolonner}>
        {soyler.map((s, i) => (
          <span key={s.etikett}>{aksetekst.includes(i) ? s.kort : ""}</span>
        ))}
      </div>
      <details className="tabellvisning">
        <summary>Vis som tabell</summary>
        <table>
          <tbody>
            {soyler.map((s) => (
              <tr key={s.etikett}>
                <th scope="row">{s.etikett}</th>
                {stablet ? (
                  <>
                    <td>{tall(s.opp)} opp</td>
                    <td>{tall(s.ned ?? 0)} ned</td>
                  </>
                ) : (
                  <td>{tall(s.opp)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

type Stolpe = { etikett: string; under?: string; opp: number; ned?: number };

// Vannrette stolper med plassnummer og verdien ved enden. Med ned stables tommel
// ned etter tommel opp.
export function Stolper({ stolper }: { stolper: Stolpe[] }) {
  const maks = Math.max(1, ...stolper.map((s) => s.opp + (s.ned ?? 0)));
  return (
    <ol className="bjelker">
      {stolper.map((s, i) => {
        const sum = s.opp + (s.ned ?? 0);
        const verdi = s.ned === undefined ? tall(sum) : `${tall(s.opp)} / ${tall(s.ned)}`;
        return (
          <li key={i} className="bjelke">
            <span className="bjelke-etikett" title={s.etikett}>
              <span className="bjelke-plass">{i + 1}</span>
              {s.etikett}
              {s.under && <span className="meta"> {s.under}</span>}
            </span>
            <span className="bjelke-spor">
              <span className="bjelke-fyll" style={stil({ width: `${(sum / maks) * 100}%`, "--i": i })}>
                {s.opp > 0 && <span className="farge-opp" style={{ flexGrow: s.opp }} />}
                {!!s.ned && <span className="farge-ned" style={{ flexGrow: s.ned }} />}
              </span>
              <span className="bjelke-verdi">{verdi}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
