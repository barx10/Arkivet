import { generelt } from "@/lib/generelt";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAKS_LENGDE = 1000;

export async function POST(request: Request) {
  let body: { sporsmal?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const sporsmal = typeof body.sporsmal === "string" ? body.sporsmal.trim() : "";
  if (!sporsmal || sporsmal.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig spørsmål" }, { status: 400 });
  }

  // Samme NDJSON-format som /api/samtale.
  const enc = new TextEncoder();
  const strom = new ReadableStream<Uint8Array>({
    async start(kontroll) {
      const send = (x: unknown) => kontroll.enqueue(enc.encode(JSON.stringify(x) + "\n"));
      try {
        for await (const tekst of generelt(sporsmal)) send({ type: "tekst", tekst });
        send({ type: "ferdig" });
      } catch (err) {
        // Logger feilmeldingen, aldri spørsmålet.
        console.error("generelt feilet:", err instanceof Error ? err.message : err);
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
