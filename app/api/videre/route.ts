import { arbeidVidere } from "@/lib/videre";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAKS_LENGDE = 1000;

export async function POST(request: Request) {
  let body: { tema?: unknown; kjente?: unknown; fraAar?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const tema = typeof body.tema === "string" ? body.tema.trim() : "";
  if (!tema || tema.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig tema" }, { status: 400 });
  }
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

  try {
    return Response.json(await arbeidVidere(tema, kjente, { fraAar }));
  } catch (err) {
    // Logger feilmeldingen, aldri temaet.
    console.error("arbeid videre feilet:", err instanceof Error ? err.message : err);
    return Response.json({ feil: "Kunne ikke lage forslag" }, { status: 500 });
  }
}
