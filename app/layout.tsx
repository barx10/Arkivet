import type { Metadata } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Schibsted Grotesk for grensesnittet, Literata for teksten som skal leses:
// svar, utdrag og sitater.
const grotesk = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });

export const metadata: Metadata = {
  title: "Arkivet",
  description: "Søk og svar i egne tekster",
  robots: { index: false, follow: false },
};

// Lyst tema er standard, uavhengig av systemet. Mørkt velges med bryteren og huskes
// i localStorage. Skriptet setter temaet før siden tegnes, så det ikke blinker.
const TEMA_SKRIPT = `(function(){try{if(localStorage.getItem("bloggbot-tema")==="mork")document.documentElement.dataset.tema="mork"}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" className={`${grotesk.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SKRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
