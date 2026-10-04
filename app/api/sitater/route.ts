import { finnSitater } from "@/lib/sitater";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAKS_LENGDE = 1000;

export async function POST(request: Request) {
  let body: { tema?: unknown; fraAar?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const tema = typeof body.tema === "string" ? body.tema.trim() : "";
  if (!tema || tema.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig tema" }, { status: 400 });
  }
  const fraAar =
    typeof body.fraAar === "number" && Number.isInteger(body.fraAar)
      ? body.fraAar
      : undefined;

  try {
    const { sitater } = await finnSitater(tema, { fraAar });
    return Response.json({ sitater });
  } catch (err) {
    // Logger feilmeldingen, aldri temaet.
    console.error("sitater feilet:", err instanceof Error ? err.message : err);
    return Response.json({ feil: "Kunne ikke finne sitater" }, { status: 500 });
  }
}
