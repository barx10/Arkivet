import { mestBrukteSok, registrerSok } from "@/lib/lager";

export const runtime = "nodejs";

const ANTALL = 5;
const MAKS_LENGDE = 1000;

export async function GET() {
  try {
    return Response.json({ forslag: await mestBrukteSok(ANTALL) });
  } catch (err) {
    console.error("forslag feilet:", err instanceof Error ? err.message : err);
    return Response.json({ forslag: [] });
  }
}

export async function POST(request: Request) {
  let body: { tekst?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }
  const tekst = typeof body.tekst === "string" ? body.tekst.trim() : "";
  if (!tekst || tekst.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig søk" }, { status: 400 });
  }
  try {
    await registrerSok(tekst);
    return Response.json({ ok: true });
  } catch (err) {
    // Logger feilmeldingen, aldri søket.
    console.error(
      "registrering av søk feilet:",
      err instanceof Error ? err.message : err,
    );
    return Response.json({ feil: "Kunne ikke lagre søket" }, { status: 500 });
  }
}
