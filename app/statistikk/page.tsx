import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { hentTekster } from "@/lib/arkiv";
import { eksempelStatistikk } from "@/lib/eksempeldata";
import { dagIOslo, harLager, hentSokStatistikk, hentVurderinger } from "@/lib/lager";
import { kilderIVurderinger, sisteDager, vurderingerPerManed } from "@/lib/statistikk";
import TemaBryter from "../tema";
import { Fordeling, Forklaring, Minisoyler, Soyler, Stolper } from "./diagram";
import { Aarsvelger, Opptelling } from "./levende";

export const metadata: Metadata = { title: "Statistikk · Arkivet" };

const DAGER = 30;
const ANTALL = 10;
const MANEDER = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

const datoKort = (dag: string) => `${Number(dag.slice(8))}. ${MANEDER[Number(dag.slice(5, 7)) - 1]}`;
const manedKort = (m: string) => `${MANEDER[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;
// Første, midterste og siste etikett på aksen.
const ytterOgMidt = (n: number) => [0, Math.floor((n - 1) / 2), n - 1];

export default async function Side() {
  await connection();
  const [tekster, lagretSok, lagredeVurderinger] = await Promise.all([
    hentTekster(),
    hentSokStatistikk(ANTALL).catch((err) => {
      console.error("søkestatistikk feilet:", err instanceof Error ? err.message : err);
      return null;
    }),
    hentVurderinger().catch((err) => {
      console.error("vurderinger feilet:", err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  // Uten lagring vises oppdiktede tall, merket som eksempeldata, så siden kan vises fram.
  const eksempel = harLager() ? null : eksempelStatistikk(tekster, dagIOslo(), ANTALL);
  const sok = eksempel?.sok ?? lagretSok;
  const vurderinger = eksempel?.vurderinger ?? lagredeVurderinger;

  const dager = sisteDager(sok?.perDag ?? {}, dagIOslo(), DAGER);
  // Søk telles per dag fra den dagen telleren ble tatt i bruk.
  const forsteDag = Object.keys(sok?.perDag ?? {}).sort()[0];
  const maneder = vurderingerPerManed(vurderinger ?? []);
  const kilder = kilderIVurderinger(vurderinger ?? [], ANTALL);
  const opp = vurderinger?.filter((v) => v.dom === "opp").length ?? 0;
  const ned = (vurderinger?.length ?? 0) - opp;
  const andelOpp = vurderinger?.length ? Math.round((opp / vurderinger.length) * 100) : null;
  const sum = (d: typeof dager) => d.reduce((s, x) => s + x.antall, 0);
  const sisteUke = sum(dager.slice(-7));
  const ukaFor = sum(dager.slice(-14, -7));
  const endring = ukaFor ? Math.round(((sisteUke - ukaFor) / ukaFor) * 100) : null;
  const boker = tekster.filter((t) => t.kilde === "bok").length;
  const aar = [...new Set(tekster.map((t) => t.dato.slice(0, 4)))].sort();

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

      <main className="statistikk">
        <p className="intro-tittel">Statistikk</p>
        <p className="intro-tekst">Hva du søker på, hvordan svarene vurderes, og hva arkivet inneholder.</p>
        {eksempel && (
          <p className="eksempeldata">
            <strong>Eksempeldata.</strong> Lagringen er ikke satt opp, så søk og vurderinger under er oppdiktet.
            Tekstene per år er ekte.
          </p>
        )}
        {harLager() && (!sok || !vurderinger) && <p className="feil">Fikk ikke hentet alle tallene fra lagringen.</p>}

        <div className="nokkeltall-rad">
          <div className="nokkeltall">
            <p className="nokkeltall-etikett">Søk</p>
            <p className="nokkeltall-verdi">
              <Opptelling verdi={sok?.totalt ?? 0} />
            </p>
            <p className="nokkeltall-under">
              {sisteUke} siste 7 dager
              {endring !== null && (
                <span className={endring >= 0 ? "endring opp" : "endring ned"}>
                  {" "}
                  {endring >= 0 ? "▲" : "▼"} {Math.abs(endring)} %
                </span>
              )}
            </p>
            <Minisoyler verdier={dager.map((d) => d.antall)} />
          </div>
          <div className="nokkeltall">
            <p className="nokkeltall-etikett">Vurderinger</p>
            <p className="nokkeltall-verdi">
              <Opptelling verdi={vurderinger?.length ?? 0} />
            </p>
            <p className="nokkeltall-under">{andelOpp === null ? "Ingen ennå" : `${andelOpp} % tommel opp`}</p>
            <Fordeling opp={opp} ned={ned} />
          </div>
          <div className="nokkeltall">
            <p className="nokkeltall-etikett">Tekster</p>
            <p className="nokkeltall-verdi">
              <Opptelling verdi={tekster.length} />
            </p>
            <p className="nokkeltall-under">
              {tekster.length - boker} artikler, {boker} bøker
            </p>
            <Minisoyler verdier={aar.map((a) => tekster.filter((t) => t.dato.startsWith(a)).length)} />
          </div>
        </div>

        <section className="diagram">
          <h2>Søk per dag</h2>
          <p className="meta">
            De siste {DAGER} dagene.{forsteDag && !eksempel && ` Telles fra ${datoKort(forsteDag)} ${forsteDag.slice(0, 4)}.`}
          </p>
          <Soyler
            soyler={dager.map((d) => ({ etikett: datoKort(d.dag), kort: datoKort(d.dag), opp: d.antall }))}
            enhet="søk"
            aksetekst={ytterOgMidt(dager.length)}
          />
        </section>

        <section className="diagram">
          <h2>Mest brukte søk</h2>
          {sok?.mest.length ? (
            <Stolper stolper={sok.mest.map((s) => ({ etikett: s.tekst, opp: s.antall }))} />
          ) : (
            <p className="meta">Ingen søk ennå.</p>
          )}
        </section>

        <section className="diagram">
          <h2>Vurderinger per måned</h2>
          {maneder.length ? (
            <>
              <Forklaring />
              <Soyler
                soyler={maneder.map((m) => ({ etikett: manedKort(m.maned), kort: manedKort(m.maned), opp: m.opp, ned: m.ned }))}
                enhet="vurderinger"
                aksetekst={ytterOgMidt(maneder.length)}
              />
            </>
          ) : (
            <p className="meta">Ingen vurderinger ennå.</p>
          )}
        </section>

        <section className="diagram">
          <h2>Kilder i vurderte svar</h2>
          {kilder.length ? (
            <>
              <p className="meta">Tekstene som oftest er brukt i svar du har vurdert, opp / ned.</p>
              <Forklaring />
              <Stolper stolper={kilder.map((k) => ({ etikett: k.tittel, under: k.aar, opp: k.opp, ned: k.ned }))} />
            </>
          ) : (
            <p className="meta">Ingen vurderinger ennå.</p>
          )}
        </section>

        <section className="diagram">
          <h2>Tekster per år</h2>
          <p className="meta">
            {aar[0]} til {aar[aar.length - 1]}. Klikk på et år for å se tekstene.
          </p>
          <Aarsvelger tekster={tekster} />
        </section>
      </main>
    </div>
  );
}
