// Modellen kan avslutte svaret med <bakgrunn>…</bakgrunn>: generell kunnskap om noe
// tekstene nevner uten å forklare. Den skal vises atskilt fra svaret. Ren funksjon uten
// serveravhengigheter, så den kan brukes både i nettleseren og på serveren.

export const FINNER_IKKE = "Jeg finner ikke dette i tekstene dine";

const START = "<bakgrunn>";
const SLUTT = "</bakgrunn>";

export function delSvar(tekst: string): { svar: string; bakgrunn: string } {
  const i = tekst.indexOf(START);
  if (i < 0) {
    // Under strømming kan starten av taggen komme før resten; skjul den så lenge.
    const delvis = tekst.match(/<[a-z]*$/);
    const kutt = delvis && START.startsWith(delvis[0]) ? delvis.index! : tekst.length;
    return { svar: tekst.slice(0, kutt).trim(), bakgrunn: "" };
  }
  const bakgrunn = tekst
    .slice(i + START.length)
    .split(SLUTT)[0]
    // Bakgrunnen skal ikke ha kildehenvisninger; fjern dem hvis modellen likevel skriver dem.
    .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "")
    .trim();
  return { svar: tekst.slice(0, i).trim(), bakgrunn };
}
