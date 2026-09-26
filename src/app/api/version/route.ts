// Roksal Field - API: verzija (build žig)
// ---------------------------------------------------------------------------
// R179 — javna ruta za preverbo "na voljo je nova verzija": odprt tab (tudi
// odjavljen) ima svoj build žig vgrajen v chunk-e (NEXT_PUBLIC_BUILD_STAMP,
// nastanjen ob gradnji v next.config.ts); ta ruta vrne žig TRENUTNEGA deploya.
// Razlika = zastarel tab → banner z gumbom Osveži (src/components/roksal/
// update-banner.tsx). Odločitev je čista funkcija v src/lib/posodobitev-jedro.ts.
//
// Varnost: vrača IZKLJUČNO build žig (čas gradnje) — brez podatkov, brez
// poti, brez metrike. Javna po zasnovi (proxy PUBLIC_EXACT), ker mora delovati
// tudi za odjavljene/zastarele seje; no-store pride iz next.config headers().
export async function GET() {
  const build = process.env.NEXT_PUBLIC_BUILD_STAMP ?? null
  return Response.json({ build })
}
