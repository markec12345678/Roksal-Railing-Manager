// Roksal Field - API: verzija (build žig) — JAVNA pod-pot /api/public/*
// ---------------------------------------------------------------------------
// R181 — dvojček rute /api/version (isto polje { build }). Razlog: produkcija
// je po R179 IN R180 deployih ŠE VEDNO vračala 401 za /api/version, čeprav je
// ruta v proxy PUBLIC_EXACT (R179) in lokalno deluje — telo odgovora
// 'Neavtoriziran dostop' iz proxy-ja + kontrolni eksperimenti na produkciji
// (/api/setup 200 = R137 entry prepuščen; /api/jobs/run 401 z razlogom IZ RUTE
// = R141 entry prepuščen; /api/public/probe 404 = prefix prepuščen, ruta
// ne obstaja) dokazujejo, da Vercel poganja STAR (pre-R179) middleware
// artefakt: poznane javne poti prepušča, /api/version pa blokira. Dva deploya
// (R179 16:26 UTC, R180 17:11 UTC) tega NISTA odpravila — 78+ min ni
// "propagacija", ampak obstoječ artefakt.
//
// Rešitev je deterministična in brez infrastrukturnih posegov: prefix
// /api/public je v proxy PUBLIC_PREFIXES (kontrolni probe na produkciji:
// 404, ne 401), zato ta dvojček deluje TUDI pod starim middleware-om.
// Klient (update-banner) poskusi NAJPREJ /api/public/version, nato še
// /api/version — v obeh svetovih (star ali svež middleware) vsaj ena pot
// odgovori. Varnost: vrača IZKLJUČNO build žig — ničesar ne izdaja;
// no-store pride iz next.config headers() (vir /api/:path*).
export async function GET() {
  const build = process.env.NEXT_PUBLIC_BUILD_STAMP ?? null
  return Response.json({ build })
}
