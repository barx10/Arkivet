import { geminiPost } from "@/lib/gemini";
import { sok, type Tidsrom, type Treff } from "@/lib/sok";

// Grundig svar: en språkmodell deler spørsmålet opp i flere søk, og treffene fra
// alle søkene flettes før svaret skrives. Mønsteret er hentet fra Ask i Open Notebook
// (github.com/lfnovo/open-notebook), men uten egne delsvar per søk: her skrives ett
// svar over alle kildene, så det koster ett ekstra modellkall, ikke fem.

export const MAKS_DELSOK = 4;
export const ANTALL_GRUNDIG = 24;

const PLAN_MODELLER = ["gemini-3.8-flash", "gemini-3.7-flash"];
const PLAN_TOKENS = 1024;

const PLANPROMPT = `Du planlegger søk i et arkiv med én lærers egne tekster: blogginnlegg fra 2012 til i dag og bøker om skole, litteratur, samfunn og kunstig intelligens. Søket er semantisk og finner tekstbiter som ligner søketeksten.

Del spørsmålet opp i 2 til ${MAKS_DELSOK} korte søk som til sammen dekker det fra ulike sider: delspørsmål, beslektede begreper, ulike perioder, eller ord og vendinger forfatteren trolig har brukt. Hvert søk er en kort setning eller noen nøkkelord, på samme språk som spørsmålet. Ikke gjenta spørsmålet ordrett, og ikke finn på navn eller fakta. Er spørsmålet smalt, holder 2 søk.

Svar bare med JSON: {"sok": ["…", "…"]}`;

type GenerertSvar = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

// Leser søkene fra modellens svar. Ukjent form gir tom liste, og da søkes det bare
// på selve spørsmålet.
export function lesPlan(tekst: string, sporsmal: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(tekst.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return [];
  }
  const liste = (data as { sok?: unknown })?.sok;
  if (!Array.isArray(liste)) return [];
  const sett = new Set([sporsmal.trim().toLowerCase()]);
  const ut: string[] = [];
  for (const s of liste) {
    if (typeof s !== "string") continue;
    const t = s.trim().slice(0, 300);
    if (!t || sett.has(t.toLowerCase())) continue;
    sett.add(t.toLowerCase());
    ut.push(t);
    if (ut.length === MAKS_DELSOK) break;
  }
  return ut;
}

export async function planlegg(sporsmal: string): Promise<string[]> {
  const data = await geminiPost<GenerertSvar>(PLAN_MODELLER, "generateContent", {
    systemInstruction: { parts: [{ text: PLANPROMPT }] },
    contents: [{ role: "user", parts: [{ text: `Spørsmål: ${sporsmal}` }] }],
    generationConfig: {
      maxOutputTokens: PLAN_TOKENS,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    },
  });
  const tekst = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("")
    .trim();
  return lesPlan(tekst, sporsmal);
}

// Fletter rangerte lister annenhver gang, med den første lista (selve spørsmålet)
// først i hver runde. Én bit per tekst, som i vanlig søk.
export function flett(lister: Treff[][], antall: number): Treff[] {
  const sett = new Set<string>();
  const ut: Treff[] = [];
  const lengst = Math.max(0, ...lister.map((l) => l.length));
  for (let plass = 0; plass < lengst && ut.length < antall; plass++) {
    for (const liste of lister) {
      const t = liste[plass];
      if (!t || sett.has(t.fil)) continue;
      sett.add(t.fil);
      ut.push(t);
      if (ut.length === antall) break;
    }
  }
  return ut;
}

// Søker på spørsmålet og hvert delsøk, og fletter treffene.
export async function grundigSok(
  sporsmal: string,
  opts: Tidsrom = {},
): Promise<{ delsok: string[]; treff: Treff[] }> {
  // Feiler planleggingen, blir det et vanlig søk på spørsmålet.
  const delsok = await planlegg(sporsmal).catch((err) => {
    console.error("planlegging feilet:", err instanceof Error ? err.message : err);
    return [] as string[];
  });
  const lister = await Promise.all([sporsmal, ...delsok].map((s) => sok(s, opts)));
  return { delsok, treff: flett(lister, ANTALL_GRUNDIG) };
}
