# Arkivet

Søk og svar over dine egne tekster (blogginnlegg, artikler, bøker). Svarene bygger bare på tekstene dine, med kilde for hver påstand. Norsk grensesnitt, Next.js (App Router) og Gemini.

Ingen database: tekstbitene og vektorene ligger i `data/` og lastes inn i minnet. Teksten din forlater maskinen bare som kall til Gemini API.

## Kom i gang

```bash
npm install
cp .env.example .env        # fyll inn GEMINI_API_KEY og SITE_PASSWORD
npm run indekser            # deler opp tekster/ og lager data/ (bruker Gemini-nøkkelen)
npm run dev                 # http://localhost:3000
```

Repoet leveres med tre korte eksempeltekster i `tekster/artikler/`. Bytt dem ut med dine egne.

## Dine tekster

Hver tekst er en markdown-fil med frontmatter:

```markdown
---
tittel: Tittelen på teksten
dato: 2024-05-17
url: https://eksempel.no/lenke-til-teksten
---

# Tittelen

Brødteksten …
```

- Artikler: `tekster/artikler/`
- Bøker og lengre verk (valgfritt, samme format): `tekster/bøker/`
- Tekster du vil beholde, men ikke ha med i søket: slett eller flytt dem ut av disse mappene.

Kjør `npm run indekser` på nytt etter endringer. Bare nye eller endrede biter vektoriseres. `npm run indekser -- --sjekk` viser hva som ville skjedd, uten API-kall.

`tekster/` og `data/` er ignorert av git (unntatt eksemplene), så du ikke kommer til å publisere tekster du ikke eier rettighetene til.

## Miljøvariabler

| Variabel | Påkrevd | Bruk |
|---|---|---|
| `GEMINI_API_KEY` | ja | Embedding og svar. Brukes bare på serveren. |
| `SITE_PASSWORD` | ja | Passord for hele siden. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | nei | Upstash Redis: «tidligere søk» og tommel opp/ned. |

## Kommandoer

```bash
npm run dev        # utviklingsserver
npm run build      # produksjonsbygg (krever data/, kjør indekser først)
npm run indekser   # bygg data/ fra tekster/
npm test           # enhetstester
npm run lint
```

## Deploy

Fungerer på Vercel eller annen Node-host. `data/` må være med i bygget, så fjern `/data/` fra `.gitignore` i din egen kopi hvis du deployer fra git og har rett til å publisere tekstene, eller bygg i CI etter `npm run indekser`. Sett miljøvariablene i prosjektet.

## Lisens

MIT. Se `LICENSE`.
