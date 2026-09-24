import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
