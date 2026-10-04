import { samtaleSvar, type Melding } from "@/lib/svar";

export const runtime = "nodejs";
// Omformulering, søk og strømming, pluss eventuelle nye forsøk mot Gemini.
export const maxDuration = 60;

const MAKS_SPORSMAL = 1000;
const MAKS_MELDING = 4000;
// Bare de siste utvekslingene sendes med som kontekst.
const MAKS_HISTORIKK = 6;

function lesMeldinger(verdi: unknown): Melding[] | null {
  if (!Array.isArray(verdi) || verdi.length === 0) return null;
  const meldinger: Melding[] = [];
  for (const [i, m] of verdi.entries()) {
    const rolle = i % 2 === 0 ? "bruker" : "bot";
    if (!m || m.rolle !== rolle || typeof m.tekst !== "string") return null;
    meldinger.push({ rolle, tekst: m.tekst.trim().slice(0, MAKS_MELDING) });
  }
  // Siste melding er det nye spørsmålet.
  return meldinger.at(-1)!.rolle === "bruker" ? meldinger : null;
}

export async function POST(request: Request) {
  let body: { meldinger?: unknown; kjente?: unknown; fraAar?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const meldinger = lesMeldinger(body.meldinger);
  const sporsmal = meldinger?.at(-1)?.tekst ?? "";
  if (!meldinger || !sporsmal || sporsmal.length > MAKS_SPORSMAL) {
    return Response.json({ feil: "Ugyldig spørsmål" }, { status: 400 });
  }
  const historikk = meldinger.slice(0, -1).slice(-MAKS_HISTORIKK);
  const kjente =
    Array.isArray(body.kjente) &&
    body.kjente.length <= 500 &&
    body.kjente.every((f) => typeof f === "string" && f.length <= 300)
      ? (body.kjente as string[])
      : [];
  const fraAar =
    typeof body.fraAar === "number" && Number.isInteger(body.fraAar)
      ? body.fraAar
      : undefined;

  // Svarer med én JSON-hendelse per linje (NDJSON), så nettleseren kan vise teksten fortløpende.
  const enc = new TextEncoder();
  const strom = new ReadableStream<Uint8Array>({
    async start(kontroll) {
      const send = (x: unknown) => kontroll.enqueue(enc.encode(JSON.stringify(x) + "\n"));
      try {
        for await (const h of samtaleSvar(historikk, sporsmal, kjente, { fraAar })) send(h);
        send({ type: "ferdig" });
      } catch (err) {
        // Logger feilmeldingen, aldri spørsmålet.
        console.error("samtale feilet:", err instanceof Error ? err.message : err);
        send({ type: "feil", feil: "Kunne ikke lage svar" });
      } finally {
        kontroll.close();
      }
    },
  });
  return new Response(strom, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
