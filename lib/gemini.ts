const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FORSOK = 3;

class MidlertidigFeil extends Error {}

// Gemini svarer 429/503 ved høy last; det går som regel over etter kort tid.
function kanProvesIgjen(status: number) {
  return status === 429 || status === 500 || status === 503;
}

function apiNokkel(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY mangler");
  return key;
}

async function post(url: string, key: string, body: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
    });
  } catch {
    throw new MidlertidigFeil("Nettverksfeil mot Gemini");
  }
  if (!res.ok) {
    const Feil = kanProvesIgjen(res.status) ? MidlertidigFeil : Error;
    throw new Feil(`Gemini svarte ${res.status}`);
  }
  return res;
}

// Prøver hver modell i rekkefølge, med noen nye forsøk ved midlertidige feil.
async function medForsok<T>(
  modeller: string | string[],
  kall: (modell: string) => Promise<T>,
): Promise<T> {
  let sisteFeil: unknown;
  for (const modell of Array.isArray(modeller) ? modeller : [modeller]) {
    for (let forsok = 1; forsok <= FORSOK; forsok++) {
      try {
        return await kall(modell);
      } catch (err) {
        if (!(err instanceof MidlertidigFeil)) throw err;
        sisteFeil = err;
        if (forsok < FORSOK) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** (forsok - 1)));
        }
      }
    }
  }
  throw sisteFeil;
}

export async function geminiPost<T>(
  modeller: string | string[],
  metode: "embedContent" | "batchEmbedContents" | "generateContent",
  body: unknown,
): Promise<T> {
  const key = apiNokkel();
  const json = JSON.stringify(body);
  return medForsok(modeller, async (modell) => {
    const res = await post(`${BASE}/${modell}:${metode}`, key, json);
    try {
      return (await res.json()) as T;
    } catch {
      throw new MidlertidigFeil("Ugyldig JSON fra Gemini");
    }
  });
}

type Del = { text?: string; thought?: boolean };
type Bit = { candidates?: { content?: { parts?: Del[] } }[] };

// Strømmer svartekst fra generateContent. Nye forsøk og reservemodell gjelder bare
// før strømmen har startet; feil midt i en strøm kastes videre.
export async function* geminiStrom(
  modeller: string | string[],
  body: unknown,
): AsyncGenerator<string> {
  const key = apiNokkel();
  const json = JSON.stringify(body);
  const res = await medForsok(modeller, (modell) =>
    post(`${BASE}/${modell}:streamGenerateContent?alt=sse`, key, json),
  );
  if (!res.body) throw new Error("Tom strøm fra Gemini");

  const leser = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await leser.read();
    if (value) buffer += value;
    // Siste hendelse mangler av og til den avsluttende tomme linjen.
    if (done) buffer += "\n\n";
    // SSE-hendelser skilles med en tom linje.
    let slutt: number;
    while ((slutt = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const hendelse = buffer.slice(0, slutt);
      buffer = buffer.slice(slutt).replace(/^\r?\n\r?\n/, "");
      const data = hendelse
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data) continue;
      const bit: Bit = JSON.parse(data);
      for (const del of bit.candidates?.[0]?.content?.parts ?? []) {
        if (!del.thought && del.text) yield del.text;
      }
    }
    if (done) break;
  }
}
