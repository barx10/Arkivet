import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { BOLKNAVN, type Ferdig, type KildeRef } from "@/lib/utvalg";
import type { Punkt } from "@/lib/videre";

// Utvalget som Word-dokument. Words innebygde stiler (Overskrift, Sitat), så
// navigasjonsruten virker og formatet følger med når teksten kopieres videre.

export type Valg = { tittel: string; dato: Date };

const aar = (k: KildeRef) => k.dato.slice(0, 4);
const storForbokstav = (tekst: string) => tekst.charAt(0).toUpperCase() + tekst.slice(1);
const ref = (numre: number[]) => (numre.length ? ` [${numre.join(", ")}]` : "");

// **fet** som i appen; resten som vanlig tekst.
function tekstbiter(tekst: string, stil: { italics?: boolean; size?: number } = {}): TextRun[] {
  return tekst
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((s) =>
      s.startsWith("**") && s.endsWith("**")
        ? new TextRun({ text: s.slice(2, -2), bold: true, ...stil })
        : new TextRun({ text: s, ...stil }),
    );
}

// Avsnitt og punktlister slik modellen skriver dem.
function avsnitt(tekst: string): Paragraph[] {
  return tekst
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      /^[-*] /.test(l)
        ? new Paragraph({ children: tekstbiter(l.slice(2)), bullet: { level: 0 } })
        : new Paragraph({ children: tekstbiter(l) }),
    );
}

const merket = (tittel: string) => new Paragraph({ children: [new TextRun({ text: tittel, bold: true, size: 20 })] });

const sitat = (tekst: string, k: KildeRef, nr: number, overskrift?: string) =>
  new Paragraph({
    style: "Quote",
    children: [
      new TextRun(`«${tekst}»`),
      new TextRun({ text: ` (${k.tittel}${overskrift ? `, ${overskrift}` : ""}, ${aar(k)}) [${nr}]`, italics: false, size: 18 }),
    ],
  });

function punkt(p: Punkt) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [
      ...(p.tittel ? [new TextRun({ text: `${p.tittel}. `, bold: true })] : []),
      new TextRun(p.tekst + ref(p.kilder)),
      ...(p.opphav === "utenfra" ? [new TextRun({ text: " (utenfra · ikke fra tekstene dine)", italics: true, size: 18 })] : []),
    ],
  });
}

export function byggDokument(f: Ferdig, v: Valg): Document {
  const dato = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(v.dato);
  const innhold: Paragraph[] = [
    new Paragraph({ text: v.tittel, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: dato, size: 20 })] }),
  ];

  for (const t of f.turer) {
    innhold.push(new Paragraph({ text: storForbokstav(t.sporsmal), heading: HeadingLevel.HEADING_1 }));
    if (t.sok && t.sok !== t.sporsmal) {
      innhold.push(new Paragraph({ children: [new TextRun({ text: `Søkte etter: ${t.sok}`, italics: true, size: 18 })] }));
    }
    innhold.push(...avsnitt(t.svar));
    if (t.bakgrunn) innhold.push(merket("Bakgrunn · ikke fra tekstene dine"), ...avsnitt(t.bakgrunn));
    if (t.generelt) innhold.push(merket("Generell kunnskap · ikke fra tekstene dine"), ...avsnitt(t.generelt));
    if (t.sitater.length) {
      innhold.push(new Paragraph({ text: "Sitater", heading: HeadingLevel.HEADING_2 }));
      innhold.push(...t.sitater.map((s) => sitat(s.sitat, s.kilde, s.nr)));
    }
    if (t.videre.length) {
      innhold.push(new Paragraph({ text: "Arbeid videre · forslag, ikke din tekst", heading: HeadingLevel.HEADING_2 }));
      for (const [bolk, navn] of Object.entries(BOLKNAVN)) {
        const punkter = t.videre.filter((p) => p.bolk === bolk);
        if (!punkter.length) continue;
        innhold.push(new Paragraph({ text: navn, heading: HeadingLevel.HEADING_3 }), ...punkter.map(punkt));
      }
    }
  }

  if (f.biter.length) {
    innhold.push(new Paragraph({ text: "Festede sitater og utdrag", heading: HeadingLevel.HEADING_1 }));
    innhold.push(...f.biter.map((b) => sitat(b.tekst, b.kilde, b.nr, b.overskrift)));
  }

  if (f.kilder.length) {
    innhold.push(new Paragraph({ text: "Kilder", heading: HeadingLevel.HEADING_1 }));
    innhold.push(
      ...f.kilder.map(
        (k, i) =>
          new Paragraph({
            children: [
              new TextRun(`[${i + 1}] ${k.tittel}, ${aar(k)}. `),
              new ExternalHyperlink({ link: k.url, children: [new TextRun({ text: k.url, style: "Hyperlink" })] }),
            ],
          }),
      ),
    );
  }

  return new Document({
    creator: "Arkivet",
    title: v.tittel,
    // Luft mellom avsnitt og rundt overskrifter. Words egne standardverdier gjelder ikke
    // når dokumentet lages med docx, så uten dette står alt tett i tett.
    styles: {
      default: {
        document: { paragraph: { spacing: { after: 160, line: 276 } } },
        title: { paragraph: { spacing: { after: 120 } } },
        heading1: { paragraph: { spacing: { before: 480, after: 160 }, keepNext: true } },
        heading2: { paragraph: { spacing: { before: 320, after: 120 }, keepNext: true } },
        heading3: { paragraph: { spacing: { before: 240, after: 80 }, keepNext: true } },
      },
      paragraphStyles: [
        {
          id: "Quote",
          name: "Quote",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { italics: true },
          paragraph: { indent: { left: 720 }, spacing: { before: 120, after: 120 } },
        },
      ],
    },
    sections: [{ children: innhold }],
  });
}

export const tilBlob = (f: Ferdig, v: Valg) => Packer.toBlob(byggDokument(f, v));
