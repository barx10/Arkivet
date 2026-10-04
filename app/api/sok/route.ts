import { sok } from "@/lib/sok";

export const runtime = "nodejs";

const MAKS_LENGDE = 1000;

export async function POST(request: Request) {
  let body: { sporsmal?: unknown; fraAar?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const sporsmal =
    typeof body.sporsmal === "string" ? body.sporsmal.trim() : "";
  if (!sporsmal || sporsmal.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig spørsmål" }, { status: 400 });
  }
  const fraAar =
    typeof body.fraAar === "number" && Number.isInteger(body.fraAar)
      ? body.fraAar
      : undefined;

  try {
    const treff = await sok(sporsmal, { fraAar });
    return Response.json({ treff });
  } catch (err) {
    // Logger feilmeldingen, aldri spørsmålet.
    console.error("sok feilet:", err instanceof Error ? err.message : err);
    return Response.json({ feil: "Søket feilet" }, { status: 500 });
  }
}
