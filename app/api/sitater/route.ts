import { finnSitater } from "@/lib/sitater";
import { lesTidsrom } from "@/lib/sok";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAKS_LENGDE = 1000;

export async function POST(request: Request) {
  let body: { tema?: unknown; fraAar?: unknown; tilAar?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const tema = typeof body.tema === "string" ? body.tema.trim() : "";
  if (!tema || tema.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig tema" }, { status: 400 });
  }
  const tidsrom = lesTidsrom(body);

  try {
    const { sitater } = await finnSitater(tema, tidsrom);
    return Response.json({ sitater });
  } catch (err) {
    // Logger feilmeldingen, aldri temaet.
    console.error("sitater feilet:", err instanceof Error ? err.message : err);
    return Response.json({ feil: "Kunne ikke finne sitater" }, { status: 500 });
  }
}
