import type { NextConfig } from "next";

// R179 — BUILD ŽIG: nastane TOČKO ENKRAT ob gradnji (next.config se ob buildu
// izvrednoti enkrat). Vsak deploy dobi NOV žig; odprt tab ga ima vgrajenega v
// svoje chunk-e (/api/version pa vrača žig TRENUTNEGA deploya) — razlika pomeni
// "na voljo je nova verzija" in sproži diskreten banner z gumbom Osveži.
// Fail-closed: če žig manjka (nastavitvena napaka), banner ostane SKRIT —
// nikoli lažnega "nova verzija".
const BUILD_STAMP = new Date().toISOString();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_STAMP: BUILD_STAMP,
  },

  output: "standalone",

  // S+8.2 (čiščenje prehodne poti): `outputFileTracingIncludes` za ./db/** je
  // odstranjen — vir podatkov je izključno zunanji PostgreSQL (Neon), v
  // serverless bundle ni več vgrajene SQLite baze (docs/POSTGRES-MIGRATION.md).

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
  // R120 (Problem 8): StrictMode je PONOVNO VKLOPLJEN. Prej je bil izklopljen
  // (dvakratni render v dev načinu je zmedel žive preglede kamere/canvas).
  // Dev-only učinek (produkcija ga ne uporablja): namerno pokaže probleme
  // lifecycle/hook dvakratnega izvajanja. Merilni studio in AR skenerja
  // uporabljata useEffect cleanup (stream/canvas sprostitev), zato dvakratni
  // mount oboje pravilno očisti — preverjeno z agent-browser E2E.
  reactStrictMode: true,

  // R131 (issue #5 §5): privatni API podatki NISO javno cacheirani.
  // Vsak /api/* odgovor (tudi 401/404) nosi `Cache-Control: no-store` —
  // brskalniški/posredni HTTP cache ne sme obdržati niti enega privatnega
  // odgovora (uporabnik A → odjava → uporabnik B ne sme videti A-jevih
  // podatkov). Opomba: middleware ne more vsiliti Cache-Control route
  // handlerjem (Next 16 ga od njih odvzame — preverjeno s sondo), zato je
  // točka prepričanja tu, na nivoju strežnika. Rute, ki nastavijo SVOJO
  // Cache-Control politiko (fotografije/skice: `private, max-age=3600` v
  // /api/files/*), jo obdržijo — no-store je samo privzeti rezervni.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
