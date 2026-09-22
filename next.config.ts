import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // SQLite baza mora biti v serverless bundle-u (Vercel), sicer Prisma
  // ob hladnem startu ne najde datoteke (Error code 14). build jo ustvari in
  // naseli (prisma db push + prisma/seed.cjs), db.ts pa jo ob hladnem startu
  // prekopira v zapisljiv /tmp.
  outputFileTracingIncludes: {
    "/api/**/*": ["./db/**"],
    "/**": ["./db/**"],
  },

  // Tipske napake so zdaj NAPAKA GRADNJE.
  //
  // `ignoreBuildErrors: true` je bil vklopljen in pod njim je raslo 15 tipskih
  // napak, med njimi trije pravi izračunski hrošči (razmik stebrov čez maksimum
  // sistema, statika stekla, ki je za vsak vhod vrnila "nevarno", in 900 mm
  // minimalna višina ograje). Trenutno stanje je 0 napak (`bunx tsc --noEmit`)
  // in CI to preverja ob vsakem pushu.
  //
  // Če te gradnja kdaj blokira sredi dela na terenu, jo lahko ZAČASNO spet
  // izklopiš — a takoj nato popravi kodo, ne pusti vklopljenega:
  //   typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};

export default nextConfig;
