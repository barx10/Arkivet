import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lås roten til dette prosjektet, så Next ikke velger en package-lock.json i mappen over.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  // Datafilene leses med fs i runtime og må tas med i serverless-funksjonene.
  outputFileTracingIncludes: {
    "/api/*": ["./data/biter.json", "./data/vektorer.bin"],
  },
};

export default nextConfig;
