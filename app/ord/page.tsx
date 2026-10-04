import type { Metadata } from "next";
import Ordsok from "./ordsok";

export const metadata: Metadata = { title: "Ordsøk · Arkivet" };

export default function Side() {
  return <Ordsok />;
}
