import { hentArkiv } from "@/lib/arkiv";
import Samtale from "./samtale";

export default async function Side() {
  return <Samtale arkiv={await hentArkiv()} />;
}
