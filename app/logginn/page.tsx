import { cookies } from "next/headers";
import { hentArkiv } from "@/lib/arkiv";
import { AUTH_COOKIE, authToken, likeStrenger } from "@/lib/auth";
import Skjema from "./skjema";

// Innloggingssiden er åpen. Den får antall tekster per år og titlene, som allerede
// som ofte er offentlige, men ikke selve tekstene.
// Er man allerede innlogget (via Arkivet-logoen), vises splash uten passordfelt.
export default async function LoggInn() {
  const { aar, titler } = await hentArkiv();
  const passord = process.env.SITE_PASSWORD;
  const cookie = (await cookies()).get(AUTH_COOKIE)?.value;
  const innlogget = !!passord && !!cookie && likeStrenger(cookie, await authToken(passord));
  return <Skjema aar={aar} titler={titler} innlogget={innlogget} />;
}
