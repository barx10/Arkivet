// Lagring i Upstash Redis via REST, uten egen klientpakke.
// Alle nøkler har prefikset bloggbot:, så databasen kan deles med andre prosjekter.
// Uten nøkler (lokalt uten .env-oppsett) lagres ingenting, og lesing gir tomt.

const PREFIKS = "bloggbot:";
const SOK = `${PREFIKS}sok`; // sorted set: normalisert søk -> antall
const SOK_TEKST = `${PREFIKS}sok:tekst`; // hash: normalisert søk -> siste skrivemåte
const SOK_DAG = `${PREFIKS}sok:dag`; // hash: dato (ÅÅÅÅ-MM-DD, norsk tid) -> antall søk
const VURDERINGER = `${PREFIKS}vurderinger`; // liste med JSON, nyeste først

export type Vurdering = {
  tid: string;
  dom: "opp" | "ned";
  sporsmal: string;
  sok?: string;
  // "grundig" (flere søk) eller "en-tekst" (spørsmål avgrenset til én tekst).
  modus?: "grundig" | "en-tekst";
  delsok?: string[];
  svar: string;
  kommentar?: string;
  // Tidligere spørsmål i samtalen, så oppfølginger kan forstås i ettertid.
  tidligere: string[];
  kilder: { fil: string; tittel: string; dato: string }[];
};

function oppsett() {
  const env = process.env;
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export const harLager = () => oppsett() !== null;

async function kjor(...kommandoer: (string | number)[][]): Promise<unknown[]> {
  const o = oppsett();
  if (!o) return kommandoer.map(() => null);
  const res = await fetch(`${o.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${o.token}` },
    body: JSON.stringify(kommandoer),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash svarte ${res.status}`);
  const svar: { result?: unknown; error?: string }[] = await res.json();
  const feil = svar.find((s) => s.error);
  if (feil) throw new Error(`Upstash: ${feil.error}`);
  return svar.map((s) => s.result);
}

// Like søk telles sammen: «Mobilforbud?» og «mobilforbud» er samme søk.
export const sokNokkel = (tekst: string) =>
  tekst.toLowerCase().replace(/\s+/g, " ").replace(/[\s?.!]+$/, "");

export async function registrerSok(tekst: string) {
  const n = sokNokkel(tekst);
  await kjor(["ZINCRBY", SOK, 1, n], ["HSET", SOK_TEKST, n, tekst], ["HINCRBY", SOK_DAG, dagIOslo(), 1]);
}

export const dagIOslo = (tid = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(tid);

export type SokStatistikk = {
  totalt: number;
  ulike: number;
  mest: { tekst: string; antall: number }[];
  perDag: Record<string, number>;
};

export async function hentSokStatistikk(antall: number): Promise<SokStatistikk> {
  const [alle, dager] = await kjor(["ZRANGE", SOK, 0, -1, "REV", "WITHSCORES"], ["HGETALL", SOK_DAG]);
  const par = Array.isArray(alle) ? (alle as string[]) : [];
  const sok: { nokkel: string; antall: number }[] = [];
  for (let i = 0; i < par.length; i += 2) sok.push({ nokkel: par[i], antall: Number(par[i + 1]) });
  const perDag: Record<string, number> = {};
  const d = Array.isArray(dager) ? (dager as string[]) : [];
  for (let i = 0; i < d.length; i += 2) perDag[d[i]] = Number(d[i + 1]);

  const topp = sok.slice(0, antall);
  const [tekster] = topp.length ? await kjor(["HMGET", SOK_TEKST, ...topp.map((s) => s.nokkel)]) : [[]];
  return {
    totalt: sok.reduce((sum, s) => sum + s.antall, 0),
    ulike: sok.length,
    mest: topp.map((s, i) => ({
      tekst: (Array.isArray(tekster) && tekster[i]) || s.nokkel,
      antall: s.antall,
    })),
    perDag,
  };
}

export async function mestBrukteSok(antall: number): Promise<string[]> {
  const [nokler] = await kjor(["ZRANGE", SOK, 0, antall - 1, "REV"]);
  if (!Array.isArray(nokler) || !nokler.length) return [];
  const [tekster] = await kjor(["HMGET", SOK_TEKST, ...nokler]);
  return nokler.map((n, i) => (Array.isArray(tekster) && tekster[i]) || n);
}

export async function lagreVurdering(v: Vurdering) {
  await kjor(["LPUSH", VURDERINGER, JSON.stringify(v)]);
}

export async function hentVurderinger(): Promise<Vurdering[]> {
  const [liste] = await kjor(["LRANGE", VURDERINGER, 0, -1]);
  return Array.isArray(liste) ? liste.map((s) => JSON.parse(s)) : [];
}
