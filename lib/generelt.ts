import { geminiStrom } from "@/lib/gemini";
import { SVAR_MODELLER } from "@/lib/svar";

// Svar med generell kunnskap, uten tekstene. Brukes bare når brukeren ber om det
// etter et «finner ikke»-svar, og vises atskilt fra svarene som bygger på tekstene.

const MAKS_TOKENS = 2048;

const PROMPT = `Du svarer på et spørsmål med generell kunnskap. Tekstene til den som spør, er ikke tilgjengelige for deg.

Regler:
- Kort og direkte svar på norsk bokmål: høyst 5 setninger eller 5 korte punkter. Ingen fyllord.
- Ingen kildehenvisninger som [1].
- Du vet ingenting om hva den som spør, mener eller har skrevet. Spør de om sine egne meninger («hva mener jeg om …»), si kort at det ikke står i tekstene deres, og gi i stedet en nøktern oversikt over temaet og hovedsynspunktene i debatten.
- Er du usikker, si det. Ikke dikt opp tall, navn eller årstall.`;

export async function* generelt(sporsmal: string): AsyncGenerator<string> {
  yield* geminiStrom(SVAR_MODELLER, {
    systemInstruction: { parts: [{ text: PROMPT }] },
    contents: [{ role: "user", parts: [{ text: sporsmal }] }],
    generationConfig: {
      maxOutputTokens: MAKS_TOKENS,
      thinkingConfig: { thinkingLevel: "low" },
    },
  });
}
