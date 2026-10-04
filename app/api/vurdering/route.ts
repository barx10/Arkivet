import { harLager, lagreVurdering, type Vurdering } from "@/lib/lager";

export const runtime = "nodejs";

const tekst = (v: unknown, maks: number) =>
  typeof v === "string" && v.trim() && v.length <= maks ? v.trim() : undefined;

export async function POST(request: Request) {
  if (!harLager()) {
    return Response.json({ feil: "Lagring er ikke satt opp" }, { status: 500 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const dom = body.dom === "opp" || body.dom === "ned" ? body.dom : undefined;
  const sporsmal = tekst(body.sporsmal, 1000);
  const svar = tekst(body.svar, 20000);
  if (!dom || !sporsmal || !svar) {
    return Response.json({ feil: "Ugyldig vurdering" }, { status: 400 });
  }
  const tidligere = Array.isArray(body.tidligere)
    ? body.tidligere
        .map((t) => tekst(t, 1000))
        .filter((t): t is string => !!t)
        .slice(-10)
    : [];
  const kilder = Array.isArray(body.kilder)
    ? body.kilder
        .slice(0, 30)
        .map((k: Record<string, unknown>) => ({
          fil: tekst(k?.fil, 300) ?? "",
          tittel: tekst(k?.tittel, 300) ?? "",
          dato: tekst(k?.dato, 20) ?? "",
        }))
        .filter((k) => k.fil)
    : [];

  const vurdering: Vurdering = {
    tid: new Date().toISOString(),
    dom,
    sporsmal,
    sok: tekst(body.sok, 1000),
    svar,
    kommentar: tekst(body.kommentar, 2000),
    tidligere,
    kilder,
  };
  try {
    await lagreVurdering(vurdering);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(
      "vurdering feilet:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { feil: "Kunne ikke lagre vurderingen" },
      { status: 500 },
    );
  }
}
