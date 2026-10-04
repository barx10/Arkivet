"use client";

import { useEffect, useState } from "react";

const NOKKEL = "bloggbot-tema";

// Bytter mellom lyst og mørkt tema. Skriptet i layout.tsx har allerede satt
// data-tema før første tegning; her leses det bare av og endres ved klikk.
export default function TemaBryter() {
  const [mork, setMork] = useState(false);

  useEffect(() => {
    // Leser temaet skriptet satte; finnes ikke under server-rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMork(document.documentElement.dataset.tema === "mork");
  }, []);

  function bytt() {
    const ny = !mork;
    setMork(ny);
    if (ny) document.documentElement.dataset.tema = "mork";
    else delete document.documentElement.dataset.tema;
    try {
      if (ny) localStorage.setItem(NOKKEL, "mork");
      else localStorage.removeItem(NOKKEL);
    } catch {}
  }

  const navn = mork ? "Bytt til lyst tema" : "Bytt til mørkt tema";
  return (
    <button type="button" className="tema-bryter" onClick={bytt} title={navn} aria-label={navn}>
      {mork ? "☀" : "☾"}
    </button>
  );
}
