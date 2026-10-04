export const AUTH_COOKIE = "bloggbot_auth";
export const AUTH_MAKS_ALDER = 60 * 60 * 24 * 30;

// Cookien inneholder en HMAC av passordet, ikke passordet selv.
// Bytter man SITE_PASSWORD, blir gamle cookies ugyldige.
export async function authToken(passord: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(passord),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("bloggbot-auth-v1"));
  return Buffer.from(sig).toString("hex");
}

// Sammenligning i konstant tid, så svartiden ikke avslører noe.
export function likeStrenger(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
