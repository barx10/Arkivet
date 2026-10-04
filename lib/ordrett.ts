// Sjekker at et sitat faktisk står ordrett i en kildetekst. Språkmodeller pynter av og
// til på sitater eller finner dem på, så alt som vises som sitat, må gjennom denne.
//
// Tillatte forskjeller: mellomrom og linjeskift, markdown-tegn for kursiv/fet (*, _),
// og ellipse eller anførselstegn helt i starten eller slutten av sitatet.
// Alt annet (ord, tegnsetting inne i sitatet, store/små bokstaver) må være likt.

export const MIN_ORD = 6;

function normaliser(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Fjerner det modellen gjerne legger rundt et sitat: anførselstegn og ellipser.
export function rensSitat(sitat: string): string {
  return sitat
    .trim()
    .replace(/^[«"“„'‘\s]+|[»"”'’\s]+$/g, "")
    .replace(/^(\.\.\.|…|\[…\])\s*/, "")
    .replace(/\s*(\.\.\.|…|\[…\])$/, "")
    .trim();
}

export function erOrdrett(sitat: string, kilde: string): boolean {
  const s = normaliser(rensSitat(sitat));
  if (s.split(" ").length < MIN_ORD) return false;
  return normaliser(kilde).includes(s);
}
