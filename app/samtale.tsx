"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { delSvar, FINNER_IKKE } from "@/lib/bakgrunn";
import type { Sitat } from "@/lib/sitater";
import type { Arkiv } from "@/lib/arkiv";
import { LAGRING_OKTER, leggTil, lesOkter, skrivOkter, type Okt } from "@/lib/okter";
import type { Hendelse, Kilde } from "@/lib/svar";
import { BOLKNAVN, bitDel, turId, turTilDel } from "@/lib/utvalg";
import type { Punkt } from "@/lib/videre";
import TemaBryter from "./tema";
import { UtvalgKnapp, useUtvalg } from "./utvalg";

type Tur = {
  sporsmal: string;
  svar: string;
  sok?: string;
  status: "venter" | "skriver" | "ferdig" | "feil";
  feil?: string;
  sitater?: { status: "venter" | "ferdig" | "feil"; liste: Sitat[]; feil?: string };
  // Svar med generell kunnskap, bare etter «finner ikke» og bare når brukeren ber om det.
  generelt?: { status: "venter" | "skriver" | "ferdig" | "feil"; tekst: string; feil?: string };
  // Tommel opp/ned. "skriver" = tommel ned er trykket og kommentarfeltet er åpent.
  vurdering?: { dom: "opp" | "ned"; status: "skriver" | "sender" | "lagret" | "feil"; kommentar: string };
  // Arbeid videre: retninger å skrive i, på knapp. Ikke tekst i forfatterens stemme.
  videre?: { status: "venter" | "ferdig" | "feil"; punkter: Punkt[]; feil?: string };
};

type Lagret = { id?: string; turer: Tur[]; kilder: Kilde[] };

// Ferdige turer uten det som ikke kan fortsette etter at siden lastes på nytt.
const tilLagring = (turer: Tur[]) =>
  turer
    .filter((t) => t.status === "ferdig")
    .map((t) => ({
      ...t,
      sitater: t.sitater?.status === "venter" ? undefined : t.sitater,
      generelt: t.generelt?.status === "ferdig" ? t.generelt : undefined,
      videre: t.videre?.status === "ferdig" ? t.videre : undefined,
    }));

const nyId = () => crypto.randomUUID();


const LAGRING = "bloggbot-samtale-v1";
const HENVISNING = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

const numre = (tekst: string) =>
  [...tekst.matchAll(HENVISNING)].flatMap((m) => m[1].split(",").map((n) => Number(n)));

const MINE_ARGUMENTER = "Hvilke argumenter har jeg brukt om dette? List dem opp med år.";

const FORSLAG = ["Hva har jeg skrevet om hagearbeid?", "Hva mener jeg om å skrive for hånd?"];
const ANTALL_FORSLAG = 5;
// Spørsmål kan være 1000 tegn; resten er til selve spørsmålet.
const MAKS_SITAT = 700;

const storForbokstav = (tekst: string) => tekst.charAt(0).toUpperCase() + tekst.slice(1);
const likeSok = (a: string, b: string) =>
  a.toLowerCase().replace(/[\s?.!]+$/, "") === b.toLowerCase().replace(/[\s?.!]+$/, "");

type Forslag = { liste: string[]; tidligere: boolean };

// De mest brukte søkene (lagret på serveren). Faste forslag bare før noe er søkt på.
async function hentForslag(): Promise<Forslag> {
  const res = await fetch("/api/forslag");
  const { forslag = [] }: { forslag?: string[] } = res.ok ? await res.json() : {};
  const brukte = forslag.map(storForbokstav).filter((b, i, alle) => alle.findIndex((a) => likeSok(a, b)) === i);
  return brukte.length
    ? { liste: brukte.slice(0, ANTALL_FORSLAG), tidligere: true }
    : { liste: FORSLAG, tidligere: false };
}

const oktDato = (ms: number) => new Date(ms).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

const kildeangivelse = (k: { tittel: string; dato: string; url: string }) =>
  `${k.tittel}, ${k.dato.slice(0, 4)}. ${k.url}`;

export default function Samtale({ arkiv }: { arkiv: Arkiv }) {
  const router = useRouter();
  const [turer, setTurer] = useState<Tur[]>([]);
  // Alle kilder i samtalen; kilder[i] har nr i + 1.
  const [kilder, setKilder] = useState<Kilde[]>([]);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [sporsmal, setSporsmal] = useState("");
  const [fraAar, setFraAar] = useState("");
  const [lastet, setLastet] = useState(false);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [forslag, setForslag] = useState<Forslag>({ liste: FORSLAG, tidligere: false });
  const [oktId, setOktId] = useState("");
  const [okter, setOkter] = useState<Okt<Tur>[]>([]);
  // Siste versjon av økten som ble lagt i arkivet, så den bare lagres når noe er endret.
  const arkivert = useRef("");
  const sisteTur = useRef<HTMLDivElement>(null);
  const felt = useRef<HTMLTextAreaElement>(null);
  // Det siste sitatet som ble lagt i spørsmålsfeltet, så et nytt kan erstatte det.
  const sisteSitat = useRef("");
  const utvalg = useUtvalg();
  const { oppfrisk } = utvalg;
  const ferdigeTurer = () => turer.filter((t) => t.status === "ferdig").map((t) => turTilDel(t, kilder));

  // Turer som er tatt med, får med seg sitater og forslag som kommer etterpå.
  useEffect(() => {
    oppfrisk(turer.filter((t) => t.status === "ferdig").map((t) => turTilDel(t, kilder)));
  }, [turer, kilder, oppfrisk]);

  // Samtalen lever bare i denne fanen. Leses etter første render for å unngå
  // at server-HTML og klient-HTML blir ulike.
  useEffect(() => {
    try {
      const lagret: Lagret | null = JSON.parse(sessionStorage.getItem(LAGRING) ?? "null");
      if (lagret) {
        // Engangslasting fra sessionStorage etter hydrering; kan ikke gjøres under render.
        // Et generelt svar som ikke ble ferdig før fanen ble lastet på nytt, kan ikke fortsette.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTurer(
          lagret.turer.map((t) => ({
            ...t,
            generelt: t.generelt?.status === "ferdig" ? t.generelt : undefined,
            videre: t.videre?.status === "ferdig" ? t.videre : undefined,
          })),
        );
        setKilder(lagret.kilder);
      }
      // Samtaler lagret før øktarkivet fantes, har ingen id og blir en ny økt.
      setOktId(lagret?.id ?? nyId());
    } catch {
      setOktId(nyId());
    }
    setOkter(lesOkter(localStorage.getItem(LAGRING_OKTER)));
    setLastet(true);
    hentForslag().then(setForslag, () => {});
  }, []);

  useEffect(() => {
    if (!lastet) return;
    const ferdige = turer.filter((t) => t.status === "ferdig" || t.status === "feil");
    sessionStorage.setItem(LAGRING, JSON.stringify({ id: oktId, turer: ferdige, kilder }));
  }, [turer, kilder, lastet, oktId]);

  // Øktarkivet oppdateres når en tur er ferdig, eller når noe kommer til i en ferdig tur.
  useEffect(() => {
    if (!lastet || !oktId) return;
    const lagres = tilLagring(turer);
    const innhold = JSON.stringify({ oktId, lagres, kilder });
    if (!lagres.length || innhold === arkivert.current) return;
    arkivert.current = innhold;
    let nye = leggTil(lesOkter<Tur>(localStorage.getItem(LAGRING_OKTER)), {
      id: oktId,
      endret: Date.now(),
      turer: lagres,
      kilder,
    });
    // Er lagringen full, faller de eldste øktene ut til det er plass.
    for (;;) {
      try {
        localStorage.setItem(LAGRING_OKTER, skrivOkter(nye));
        break;
      } catch {
        if (nye.length <= 1) break;
        nye = nye.slice(0, -1);
      }
    }
    // Arkivet er en kopi i localStorage; lista på forsiden følger den.
    setOkter(nye);
  }, [turer, kilder, lastet, oktId]);

  useEffect(() => {
    if (aktiv) document.getElementById(`kilde-${aktiv}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [aktiv]);

  // Arbeid videre kan legge til kilder, så ingen nye spørsmål mens forslag hentes.
  const opptatt = turer.some(
    (t) => t.status === "venter" || t.status === "skriver" || t.videre?.status === "venter",
  );

  function oppdaterSiste(endring: Partial<Tur>) {
    setTurer((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, ...endring } : t)));
  }

  function oppdater(indeks: number, endring: Partial<Tur>) {
    setTurer((ts) => ts.map((t, i) => (i === indeks ? { ...t, ...endring } : t)));
  }

  async function kopier(tekst: string, noekkel: string) {
    try {
      await navigator.clipboard.writeText(tekst);
      setKopiert(noekkel);
      setTimeout(() => setKopiert((k) => (k === noekkel ? null : k)), 1500);
    } catch {
      setKopiert(null);
    }
  }

  // Markert tekst inne i utdraget, eller tom streng.
  function markertI(utdrag: Element | null) {
    const valgt = window.getSelection();
    return valgt && !valgt.isCollapsed && utdrag?.contains(valgt.anchorNode) && utdrag.contains(valgt.focusNode)
      ? valgt.toString().trim()
      : "";
  }

  // Legger sitatet i spørsmålsfeltet, så man kan skrive spørsmålet om det etterpå.
  // Erstatter bare feltet hvis det er tomt eller fortsatt inneholder forrige sitat.
  // Fokus bare etter klikk på knappen: fokus i feltet ville fjernet markeringen i utdraget.
  function sporOm(sitat: string, fokus = false) {
    const kort = sitat.length > MAKS_SITAT ? `${sitat.slice(0, MAKS_SITAT).trimEnd()} …` : sitat;
    const ny = `Om «${kort}»: `;
    if (sporsmal.trim() && sporsmal !== sisteSitat.current) return;
    sisteSitat.current = ny;
    setSporsmal(ny);
    if (!fokus) return;
    setTimeout(() => {
      felt.current?.focus({ preventScroll: true });
      felt.current?.setSelectionRange(ny.length, ny.length);
    }, 0);
  }

  // Kopierer markert tekst inne i utdraget hvis noe er markert, ellers hele utdraget,
  // og legger det samme i spørsmålsfeltet.
  function kopierUtdrag(e: React.MouseEvent, k: Kilde, tekst: string, noekkel: string) {
    const sitat = markertI((e.currentTarget as HTMLElement).closest(".utdrag-boks")) || tekst.trim();
    kopier(`«${sitat}» (${kildeangivelse(k)})`, noekkel);
    sporOm(sitat, true);
  }

  async function hentVidere(indeks: number) {
    const t = turer[indeks];
    oppdater(indeks, { videre: { status: "venter", punkter: [] } });
    try {
      const res = await fetch("/api/videre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: t.sok ?? t.sporsmal,
          kjente: kilder.map((k) => k.fil),
          fraAar: fraAar ? Number(fraAar) : undefined,
        }),
      });
      if (res.status === 401) {
        router.push("/logginn");
        return;
      }
      const data: { punkter?: Punkt[]; nye?: Kilde[]; feil?: string } = await res.json();
      if (!res.ok || !data.punkter) throw new Error(data.feil ?? "Noe gikk galt");
      setKilder((ks) => [...ks, ...(data.nye ?? [])]);
      oppdater(indeks, { videre: { status: "ferdig", punkter: data.punkter } });
    } catch (err) {
      oppdater(indeks, {
        videre: {
          status: "feil",
          punkter: [],
          feil: err instanceof TypeError ? "Fikk ikke kontakt med serveren" : (err as Error).message,
        },
      });
    }
  }

  async function hentSitater(indeks: number) {
    const t = turer[indeks];
    oppdater(indeks, { sitater: { status: "venter", liste: [] } });
    try {
      const res = await fetch("/api/sitater", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: t.sok ?? t.sporsmal, fraAar: fraAar ? Number(fraAar) : undefined }),
      });
      if (res.status === 401) {
        router.push("/logginn");
        return;
      }
      const data: { sitater?: Sitat[]; feil?: string } = await res.json();
      if (!res.ok || !data.sitater) throw new Error(data.feil ?? "Noe gikk galt");
      oppdater(indeks, { sitater: { status: "ferdig", liste: data.sitater } });
    } catch (err) {
      oppdater(indeks, {
        sitater: {
          status: "feil",
          liste: [],
          feil: err instanceof TypeError ? "Fikk ikke kontakt med serveren" : (err as Error).message,
        },
      });
    }
  }

  async function hentGenerelt(indeks: number) {
    const t = turer[indeks];
    const sett = (generelt: Tur["generelt"]) => oppdater(indeks, { generelt });
    sett({ status: "venter", tekst: "" });
    let tekst = "";
    try {
      const res = await fetch("/api/generelt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Det selvstendige søket, så oppfølgingsspørsmål også gir mening alene.
        body: JSON.stringify({ sporsmal: t.sok ?? t.sporsmal }),
      });
      if (res.status === 401) {
        router.push("/logginn");
        return;
      }
      if (!res.ok || !res.body) {
        const data: { feil?: string } = await res.json().catch(() => ({}));
        throw new Error(data.feil ?? "Noe gikk galt");
      }
      await lesHendelser(res, (h) => {
        if (h.type === "tekst") {
          tekst += h.tekst;
          sett({ status: "skriver", tekst });
        }
      });
      if (!tekst.trim()) throw new Error("Tomt svar");
      sett({ status: "ferdig", tekst });
    } catch (err) {
      sett({
        status: "feil",
        tekst: "",
        feil: err instanceof TypeError ? "Fikk ikke kontakt med serveren" : (err as Error).message,
      });
    }
  }

  async function send(e?: React.FormEvent, fast?: string) {
    e?.preventDefault();
    const tekst = (fast ?? sporsmal).trim();
    if (!tekst || opptatt) return;

    // Mislykkede turer sendes ikke med som kontekst.
    const meldinger = turer
      .filter((t) => t.status === "ferdig")
      .flatMap((t) => [
        { rolle: "bruker", tekst: t.sporsmal },
        { rolle: "bot", tekst: t.svar },
      ]);
    meldinger.push({ rolle: "bruker", tekst });
    const kjente = kilder.map((k) => k.fil);

    setTurer((ts) => [...ts, { sporsmal: tekst, svar: "", status: "venter" }]);
    if (tekst !== MINE_ARGUMENTER) {
      fetch("/api/forslag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst }),
      }).catch(() => {});
    }
    if (fast === undefined) setSporsmal("");
    setTimeout(() => sisteTur.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

    let nye: Kilde[] = [];
    let svar = "";
    try {
      const res = await fetch("/api/samtale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meldinger, kjente, fraAar: fraAar ? Number(fraAar) : undefined }),
      });
      if (res.status === 401) {
        router.push("/logginn");
        return;
      }
      if (!res.ok || !res.body) {
        const data: { feil?: string } = await res.json().catch(() => ({}));
        throw new Error(data.feil ?? "Noe gikk galt");
      }

      await lesHendelser(res, (h) => {
        if (h.type === "kilder") {
          nye = h.kilder;
          oppdaterSiste({ sok: h.sok, status: "skriver" });
        } else if (h.type === "tekst") {
          svar += h.tekst;
          oppdaterSiste({ svar });
        }
      });
      if (!svar.trim()) throw new Error("Tomt svar");

      // Gi nye kilder som faktisk er brukt, fortløpende nummer etter de kjente,
      // i rekkefølgen de nevnes. Ubrukte kilder forkastes.
      const foreløpig = new Map(nye.map((k) => [k.nr, k]));
      const omnummer = new Map<number, number>();
      const tillegg: Kilde[] = [];
      // Bare henvisninger i selve svaret teller; bakgrunnen har ingen kilder.
      for (const n of numre(delSvar(svar).svar)) {
        const k = foreløpig.get(n);
        if (!k || omnummer.has(n)) continue;
        if (n <= kjente.length) {
          omnummer.set(n, n);
        } else {
          const nr = kjente.length + tillegg.length + 1;
          omnummer.set(n, nr);
          tillegg.push({ ...k, nr });
        }
      }
      const endelig = svar.replace(HENVISNING, (_, liste: string) =>
        liste
          .split(",")
          .map((n) => `[${omnummer.get(Number(n)) ?? n.trim()}]`)
          .join(""),
      );
      setKilder((ks) => [...ks, ...tillegg]);
      oppdaterSiste({ svar: endelig, status: "ferdig" });
    } catch (err) {
      oppdaterSiste({
        status: "feil",
        feil: err instanceof TypeError ? "Fikk ikke kontakt med serveren" : (err as Error).message,
      });
    }
  }

  function nySamtale() {
    setTurer([]);
    setKilder([]);
    setAktiv(null);
    setOktId(nyId());
    sessionStorage.removeItem(LAGRING);
    hentForslag().then(setForslag, () => {});
  }

  // Åpner økten der den slapp. Den flyttes øverst i arkivet først når noe nytt skjer i den.
  function apneOkt(o: Okt<Tur>) {
    arkivert.current = JSON.stringify({ oktId: o.id, lagres: tilLagring(o.turer), kilder: o.kilder });
    setOktId(o.id);
    setTurer(o.turer);
    setKilder(o.kilder);
    setAktiv(null);
    window.scrollTo(0, 0);
  }

  function slettOkt(id: string) {
    const nye = okter.filter((o) => o.id !== id);
    setOkter(nye);
    try {
      localStorage.setItem(LAGRING_OKTER, skrivOkter(nye));
    } catch {}
  }

  function vurder(indeks: number, endring: Partial<NonNullable<Tur["vurdering"]>>) {
    setTurer((ts) =>
      ts.map((t, i) =>
        i === indeks
          ? { ...t, vurdering: { dom: "opp", status: "skriver", kommentar: "", ...t.vurdering, ...endring } }
          : t,
      ),
    );
  }

  async function sendVurdering(indeks: number, dom: "opp" | "ned", kommentar = "") {
    const t = turer[indeks];
    vurder(indeks, { dom, status: "sender", kommentar });
    // Kildene svaret viser til, med nummer slik de står i hele samtalen.
    const brukte = new Set(numre(delSvar(t.svar).svar));
    try {
      const res = await fetch("/api/vurdering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dom,
          sporsmal: t.sporsmal,
          sok: t.sok,
          svar: t.svar,
          kommentar,
          tidligere: turer.slice(0, indeks).map((f) => f.sporsmal),
          kilder: kilder.filter((k) => brukte.has(k.nr)),
        }),
      });
      if (res.status === 401) {
        router.push("/logginn");
        return;
      }
      vurder(indeks, { status: res.ok ? "lagret" : "feil" });
    } catch {
      vurder(indeks, { status: "feil" });
    }
  }

  const vis = (n: number) => kilder[n - 1] && setAktiv(n);

  const skjema = (
    <form className="skjema" onSubmit={send}>
      <textarea
        ref={felt}
        rows={turer.length ? 1 : 2}
        placeholder={turer.length ? "Spør videre …" : "Spør om et tema, en person eller et standpunkt"}
        aria-label="Spørsmål"
        autoFocus
        maxLength={1000}
        value={sporsmal}
        onChange={(e) => setSporsmal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="skjema-bunn">
        <Aarstripe aar={arkiv.aar} fraAar={fraAar} velg={setFraAar} />
        <button type="submit" className="primar" disabled={opptatt || !sporsmal.trim()}>
          {opptatt ? "Leter …" : "Spør"}
        </button>
      </div>
    </form>
  );

  const forste = arkiv.aar[0]?.aar;
  const siste = arkiv.aar[arkiv.aar.length - 1]?.aar;

  return (
    <div className="ramme">
      <header className="topp">
        <h1 className="ordmerke">
          <Link href="/logginn">Arkivet</Link>
        </h1>
        <div className="topp-hoyre">
          <Link href="/ord">Ordsøk</Link>
          <UtvalgKnapp utvalg={utvalg} okt={ferdigeTurer} />
          {turer.length > 0 && (
            <button type="button" className="lenkeknapp" onClick={nySamtale} disabled={opptatt}>
              Ny samtale
            </button>
          )}
          <TemaBryter />
        </div>
      </header>

      {turer.length === 0 ? (
        <main className="intro">
          <p className="intro-tittel">Spør i tekstene dine</p>
          <p className="intro-tekst">
            {arkiv.artikler} artikler og {arkiv.boker} bøker, skrevet fra {forste} til {siste}. Svarene
            bygger bare på dem, med kilde for hver påstand.
          </p>
          {skjema}
          <div className="forslag">
            <span>{forslag.tidligere ? "Tidligere søk" : "Prøv"}</span>
            {forslag.liste.map((f) => (
              <button type="button" key={f} className="liten" title={f} onClick={() => send(undefined, f)}>
                {f}
              </button>
            ))}
          </div>
          {okter.length > 0 && (
            <section className="okter" aria-label="Tidligere økter">
              <h2>Tidligere økter</h2>
              <ol>
                {okter.map((o) => (
                  <li key={o.id}>
                    <button type="button" className="okt" onClick={() => apneOkt(o)}>
                      <span className="okt-tittel">{storForbokstav(o.turer[0]?.sporsmal ?? "")}</span>
                      <span className="meta">
                        {oktDato(o.endret)} · {o.turer.length} spørsmål
                      </span>
                    </button>
                    <button
                      type="button"
                      className="lenkeknapp kopier"
                      aria-label={`Slett økten «${o.turer[0]?.sporsmal ?? ""}»`}
                      onClick={() => slettOkt(o.id)}
                    >
                      Slett
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>
      ) : (
        <main className={kilder.length ? "oppsett med-kilder" : "oppsett"}>
          <section className="samtale">
            {turer.map((t, i) => (
              <article className="tur" key={i} ref={i === turer.length - 1 ? sisteTur : undefined}>
                <h2 className="sporsmal">{t.sporsmal}</h2>
                {t.sok && t.sok !== t.sporsmal && <p className="meta">Søkte etter: {t.sok}</p>}
                {t.status === "venter" && <p className="meta leter">Leter i tekstene …</p>}
                {t.svar && (
                  <SvarMedBakgrunn
                    tekst={t.svar}
                    vis={t.status === "ferdig" ? vis : undefined}
                    skriver={t.status === "skriver"}
                  />
                )}
                {t.status === "ferdig" && t.svar.includes(FINNER_IKKE) && !t.generelt && (
                  <div className="handlinger">
                    <button type="button" className="liten" onClick={() => hentGenerelt(i)}>
                      Svar med generell kunnskap
                    </button>
                  </div>
                )}
                {t.generelt && (
                  <aside className="generelt">
                    <p className="bakgrunn-tittel">Generell kunnskap · ikke fra tekstene dine</p>
                    {t.generelt.status === "venter" && <p className="meta leter">Skriver …</p>}
                    {t.generelt.status === "feil" && <p className="feil">{t.generelt.feil}</p>}
                    {t.generelt.tekst && (
                      <div className={t.generelt.status === "skriver" ? "skriver" : undefined}>
                        <SvarTekst tekst={t.generelt.tekst} />
                      </div>
                    )}
                  </aside>
                )}
                {t.status === "ferdig" && !t.svar.includes(FINNER_IKKE) && (
                  <div className="handlinger">
                    {i === turer.length - 1 && (
                      <button
                        type="button"
                        className="liten"
                        disabled={opptatt}
                        onClick={() => send(undefined, MINE_ARGUMENTER)}
                      >
                        Mine argumenter
                      </button>
                    )}
                    {!t.sitater && (
                      <button type="button" className="liten" onClick={() => hentSitater(i)}>
                        Finn sitater
                      </button>
                    )}
                    {!t.videre && (
                      <button type="button" className="liten" disabled={opptatt} onClick={() => hentVidere(i)}>
                        Arbeid videre
                      </button>
                    )}
                  </div>
                )}
                {t.sitater && (
                  <div className="sitater">
                    {t.sitater.status === "venter" && <p className="meta leter">Leter etter sitater …</p>}
                    {t.sitater.status === "feil" && <p className="feil">{t.sitater.feil}</p>}
                    {t.sitater.status === "ferdig" && t.sitater.liste.length === 0 && (
                      <p className="meta">Fant ingen sitater som står ordrett i tekstene.</p>
                    )}
                    {t.sitater.liste.map((s, j) => (
                      <figure className="sitat" key={j}>
                        <blockquote>«{s.sitat}»</blockquote>
                        <figcaption>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.tittel}
                          </a>
                          , {s.dato.slice(0, 4)}
                          <button
                            type="button"
                            className="lenkeknapp kopier"
                            onClick={() => kopier(`«${s.sitat}» (${kildeangivelse(s)})`, `sitat-${i}-${j}`)}
                          >
                            {kopiert === `sitat-${i}-${j}` ? "Kopiert" : "Kopier"}
                          </button>
                          <button
                            type="button"
                            className="lenkeknapp kopier"
                            onClick={() => utvalg.veksle(bitDel("sitat", s.sitat, s))}
                          >
                            {utvalg.har(bitDel("sitat", s.sitat, s).id) ? "Festet ✓" : "Fest"}
                          </button>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {t.videre && <ArbeidVidere videre={t.videre} vis={vis} provIgjen={() => hentVidere(i)} />}
                {t.status === "ferdig" && (
                  <div className="tur-bunn">
                    <button type="button" className="lenkeknapp" onClick={() => utvalg.veksle(turTilDel(t, kilder))}>
                      {utvalg.har(turId(t)) ? "Tatt med ✓" : "Ta med"}
                    </button>
                    <Vurdering
                      vurdering={t.vurdering}
                      opp={() => sendVurdering(i, "opp")}
                      ned={() => vurder(i, { dom: "ned", status: "skriver" })}
                      skriv={(kommentar) => vurder(i, { kommentar })}
                      send={() => sendVurdering(i, "ned", t.vurdering?.kommentar)}
                      avbryt={() => setTurer((ts) => ts.map((u, j) => (j === i ? { ...u, vurdering: undefined } : u)))}
                    />
                  </div>
                )}
                {t.status === "feil" && <p className="feil">{t.feil}</p>}
              </article>
            ))}

            <div className="skjema-fast">{skjema}</div>
          </section>

          {kilder.length > 0 && (
            <aside className="kildepanel" aria-label="Kilder">
              <div className="kildepanel-topp">
                <h2>Kilder</h2>
                <button
                  type="button"
                  className="lenkeknapp kopier"
                  onClick={() =>
                    kopier(kilder.map((k) => `[${k.nr}] ${kildeangivelse(k)}`).join("\n"), "kildeliste")
                  }
                >
                  {kopiert === "kildeliste" ? "Kopiert" : "Kopier kildeliste"}
                </button>
              </div>
              <ol className="kildeliste">
                {kilder.map((k) => (
                  <li className={aktiv === k.nr ? "kilde aktiv" : "kilde"} id={`kilde-${k.nr}`} key={k.nr}>
                    <span className="kilde-nr">{k.nr}</span>
                    <div className="kilde-innhold">
                      <a className="kilde-tittel" href={k.url} target="_blank" rel="noreferrer">
                        {k.tittel}
                      </a>
                      <p className="meta">
                        {k.kilde === "bok" ? "Bok" : "Artikkel"}, {k.dato.slice(0, 4)}
                      </p>
                      <details
                        open={aktiv === k.nr}
                        onToggle={(e) => {
                          const apen = (e.currentTarget as HTMLDetailsElement).open;
                          if (apen !== (aktiv === k.nr)) setAktiv(apen ? k.nr : null);
                        }}
                      >
                        <summary>{k.utdrag.length > 1 ? `Vis ${k.utdrag.length} utdrag` : "Vis utdrag"}</summary>
                        {k.utdrag.map((u, i) => (
                          <div key={i} className="utdrag-boks">
                            {u.overskrift && <p className="meta">{u.overskrift}</p>}
                            <p
                              className="utdrag"
                              onMouseUp={(e) => {
                                const markert = markertI(e.currentTarget);
                                if (markert) sporOm(markert);
                              }}
                            >
                              {u.tekst}
                            </p>
                            <button
                              type="button"
                              className="lenkeknapp kopier"
                              // Hindrer at klikket fjerner markeringen før den er lest.
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => kopierUtdrag(e, k, u.tekst, `utdrag-${k.nr}-${i}`)}
                            >
                              {kopiert === `utdrag-${k.nr}-${i}`
                                ? "Kopiert"
                                : "Kopier og spør om sitat (markert tekst eller hele utdraget)"}
                            </button>
                            <button
                              type="button"
                              className="lenkeknapp kopier"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                const markert = markertI((e.currentTarget as HTMLElement).closest(".utdrag-boks"));
                                utvalg.veksle(bitDel("utdrag", markert || u.tekst, k, u.overskrift));
                              }}
                            >
                              {utvalg.har(bitDel("utdrag", u.tekst, k).id) ? "Festet ✓" : "Fest"}
                            </button>
                          </div>
                        ))}
                      </details>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </main>
      )}
    </div>
  );
}

// Retninger å skrive i, ikke ferdig tekst. Punkter utenfra er stiplet og merket.
function ArbeidVidere({
  videre: v,
  vis,
  provIgjen,
}: {
  videre: NonNullable<Tur["videre"]>;
  vis: (n: number) => void;
  provIgjen: () => void;
}) {
  return (
    <section className="videre">
      <p className="bakgrunn-tittel">Arbeid videre · forslag, ikke din tekst</p>
      {v.status === "venter" && <p className="meta leter">Tenker videre …</p>}
      {v.status === "feil" && (
        <p className="feil">
          {v.feil}{" "}
          <button type="button" className="lenkeknapp" onClick={provIgjen}>
            Prøv igjen
          </button>
        </p>
      )}
      {v.status === "ferdig" && v.punkter.length === 0 && (
        <p className="meta">Fant ikke nok å bygge videre på.</p>
      )}
      {(Object.keys(BOLKNAVN) as Punkt["bolk"][]).map((b) => {
        const punkter = v.punkter.filter((p) => p.bolk === b);
        if (!punkter.length) return null;
        return (
          <div key={b} className="videre-bolk">
            <h3>{BOLKNAVN[b]}</h3>
            <ul>
              {punkter.map((p, j) => (
                <li key={j} className={p.opphav === "utenfra" ? "utenfra" : undefined}>
                  {p.tittel && <strong>{p.tittel}. </strong>}
                  {inline(p.kilder.length ? `${p.tekst} [${p.kilder.join(", ")}]` : p.tekst, vis)}
                  {p.opphav === "utenfra" && (
                    <span className="utenfra-merke">utenfra · ikke fra tekstene dine</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

// Tommel opp lagres med en gang. Tommel ned åpner et felt for hva som var galt,
// så dårlige svar kan bli nye testspørsmål.
function Vurdering({
  vurdering: v,
  opp,
  ned,
  skriv,
  send,
  avbryt,
}: {
  vurdering?: Tur["vurdering"];
  opp: () => void;
  ned: () => void;
  skriv: (kommentar: string) => void;
  send: () => void;
  avbryt: () => void;
}) {
  if (v?.status === "lagret") {
    return (
      <p className="vurdering meta">
        {v.dom === "opp" ? "Takk, merket som godt svar." : "Takk, lagret til gjennomgang."}
      </p>
    );
  }
  const sender = v?.status === "sender";
  if (v?.dom === "ned" && v.status !== "feil") {
    return (
      <form
        className="vurdering-skjema"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          aria-label="Hva var galt med svaret?"
          placeholder="Hva var galt? (valgfritt)"
          autoFocus
          maxLength={2000}
          value={v.kommentar}
          onChange={(e) => skriv(e.target.value)}
          disabled={sender}
        />
        <button type="submit" className="liten" disabled={sender}>
          {sender ? "Lagrer …" : "Send"}
        </button>
        <button type="button" className="lenkeknapp" onClick={avbryt} disabled={sender}>
          Avbryt
        </button>
      </form>
    );
  }
  return (
    <div className="vurdering">
      <button type="button" className="tommel" title="Godt svar" aria-label="Godt svar" onClick={opp} disabled={sender}>
        👍
      </button>
      <button type="button" className="tommel" title="Dårlig svar" aria-label="Dårlig svar" onClick={ned} disabled={sender}>
        👎
      </button>
      {v?.status === "feil" && <span className="feil">Kunne ikke lagre</span>}
    </div>
  );
}

// Årsfilteret som søylediagram: høyden er antall tekster det året. Et klikk
// velger «fra og med», et nytt klikk på samme år viser alle år igjen.
function Aarstripe({
  aar,
  fraAar,
  velg,
}: {
  aar: Arkiv["aar"];
  fraAar: string;
  velg: (aar: string) => void;
}) {
  const maks = Math.max(1, ...aar.map((a) => a.antall));
  return (
    <div className={fraAar ? "aarstripe filtrert" : "aarstripe"} role="group" aria-label="Bare tekster fra og med år">
      <div className="stolper">
        {aar.map(({ aar: a, antall }) => {
          const valgt = fraAar === String(a);
          const med = !fraAar || a >= Number(fraAar);
          return (
            <button
              type="button"
              key={a}
              className={`stolpe${med ? " med" : ""}`}
              style={{ "--hoyde": antall / maks } as CSSProperties}
              aria-pressed={valgt}
              aria-label={`Fra og med ${a}, ${antall} ${antall === 1 ? "tekst" : "tekster"}`}
              title={`${a}: ${antall} ${antall === 1 ? "tekst" : "tekster"}`}
              onClick={() => velg(valgt ? "" : String(a))}
            />
          );
        })}
      </div>
      <span className="aarstripe-tekst" aria-live="polite">
        {fraAar ? (
          <>
            Fra {fraAar}{" "}
            <button type="button" className="lenkeknapp" onClick={() => velg("")}>
              vis alle
            </button>
          </>
        ) : (
          `Alle år, ${aar[0]?.aar}–${aar[aar.length - 1]?.aar}`
        )}
      </span>
    </div>
  );
}

type StromHendelse = Hendelse | { type: "ferdig" } | { type: "feil"; feil: string };

// Leser NDJSON fra /api/samtale og /api/generelt, én hendelse per linje.
async function lesHendelser(res: Response, hendelse: (h: StromHendelse) => void) {
  const leser = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await leser.read();
    if (value) buffer += value;
    const linjer = buffer.split("\n");
    buffer = done ? "" : linjer.pop()!;
    for (const linje of linjer) {
      if (!linje.trim()) continue;
      const h: StromHendelse = JSON.parse(linje);
      if (h.type === "feil") throw new Error(h.feil);
      hendelse(h);
    }
    if (done) break;
  }
}

function SvarMedBakgrunn({
  tekst,
  vis,
  skriver,
}: {
  tekst: string;
  vis?: (n: number) => void;
  skriver?: boolean;
}) {
  const { svar, bakgrunn } = delSvar(tekst);
  return (
    <>
      {svar && (
        <div className={skriver ? "svar skriver" : "svar"}>
          <SvarTekst tekst={svar} vis={vis} />
        </div>
      )}
      {bakgrunn && (
        <aside className="bakgrunn">
          <p className="bakgrunn-tittel">Bakgrunn · ikke fra tekstene dine</p>
          <SvarTekst tekst={bakgrunn} />
        </aside>
      )}
    </>
  );
}

// Enkel gjengivelse av svaret: avsnitt, punktlister, **fet** og [n]-henvisninger.
// Bygger React-noder direkte i stedet for å sette inn HTML.
function SvarTekst({ tekst, vis }: { tekst: string; vis?: (n: number) => void }) {
  const blokker: ReactNode[] = [];
  let punkter: string[] = [];

  const tomPunkter = () => {
    if (punkter.length) {
      blokker.push(
        <ul key={blokker.length}>
          {punkter.map((p, i) => (
            <li key={i}>{inline(p, vis)}</li>
          ))}
        </ul>,
      );
      punkter = [];
    }
  };

  for (const linje of tekst.split("\n")) {
    const punkt = linje.match(/^\s*[*-]\s+(.*)$/);
    if (punkt) {
      punkter.push(punkt[1]);
    } else {
      tomPunkter();
      if (linje.trim()) blokker.push(<p key={blokker.length}>{inline(linje, vis)}</p>);
    }
  }
  tomPunkter();
  return <>{blokker}</>;
}

function inline(tekst: string, vis?: (n: number) => void): ReactNode {
  // Hardt mellomrom foran henvisninger, så de ikke brytes alene til neste linje.
  return tekst.replace(/\s+(?=\[\d)/g, "\u00a0").split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[\d+(?:\s*,\s*\d+)*\])/g).map((del, i) => {
    if (del.startsWith("**") && del.endsWith("**")) {
      return <strong key={i}>{del.slice(2, -2)}</strong>;
    }
    if (del.length > 2 && del.startsWith("*") && del.endsWith("*")) {
      return <em key={i}>{del.slice(1, -1)}</em>;
    }
    const ref = del.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (ref) {
      // Lenker, ikke knapper: knapper er inline-block og lar punktum etter
      // henvisningen bryte til en ny linje.
      return (
        <span key={i} className="henvisninger">
          {ref[1].split(",").map((n) => {
            const nr = Number(n);
            return vis ? (
              <a
                key={n}
                href={`#kilde-${nr}`}
                className="henvisning"
                aria-label={`Kilde ${nr}`}
                onClick={(e) => {
                  e.preventDefault();
                  vis(nr);
                }}
              >
                {nr}
              </a>
            ) : (
              <span key={n} className="henvisning" aria-label={`Kilde ${nr}`}>
                {nr}
              </span>
            );
          })}
        </span>
      );
    }
    return del;
  });
}
