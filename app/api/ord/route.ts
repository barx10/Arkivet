import { ordsok } from "@/lib/ordsok";

export const runtime = "nodejs";

const MAKS_LENGDE = 200;

export async function POST(request: Request) {
  let body: { uttrykk?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const uttrykk = typeof body.uttrykk === "string" ? body.uttrykk.trim() : "";
  if (!uttrykk || uttrykk.length > MAKS_LENGDE) {
    return Response.json({ feil: "Ugyldig søk" }, { status: 400 });
  }

  try {
    return Response.json({ tekster: await ordsok(uttrykk) });
  } catch (err) {
    // Logger feilmeldingen, aldri søket.
    console.error("ordsok feilet:", err instanceof Error ? err.message : err);
    return Response.json({ feil: "Søket feilet" }, { status: 500 });
  }
}
