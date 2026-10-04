import { AUTH_COOKIE, AUTH_MAKS_ALDER, authToken, likeStrenger } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const passord = process.env.SITE_PASSWORD;
  if (!passord) {
    return Response.json({ feil: "SITE_PASSWORD er ikke satt" }, { status: 500 });
  }

  let forsok = "";
  try {
    const body: { passord?: unknown } = await request.json();
    if (typeof body.passord === "string") forsok = body.passord;
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel" }, { status: 400 });
  }

  const riktig = await authToken(passord);
  if (!likeStrenger(await authToken(forsok), riktig)) {
    // Litt forsinkelse gjør gjetting tregere.
    await new Promise((r) => setTimeout(r, 1000));
    return Response.json({ feil: "Feil passord" }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${AUTH_COOKIE}=${riktig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_MAKS_ALDER}${secure}`,
      },
    },
  );
}
