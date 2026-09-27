// R229 — EN VIR badgea 'Pretekel rok' (sorojenik BadgeBrezDobavitelja R222 /
// BadgeNizkaZaloga R219 — ZAMUJENA tema, tretja dimenzija: zanesljivost
// dobav).
// ---------------------------------------------------------------------------
// R228 je 'zamujena dobava' vpeljala kot vodjo kartico (roksal-red družina —
// ALARM: pretečen obljubljeni rok je isti pomen kot potekel opomnik v CRM).
// R229 — dimenzija dobi glas TUDI v obstoječih signalcih: zvonček (vrstice
// naročil s pretečenim datumDobave iz ISTEGA /api/material-orders fetcha —
// EN VIR, nič nove zahteve) in Material → Naročila per-vrstična oznaka.
// Da so vsi signalci VIDA enako, je definicija TOČNO ENKRAT (ta datoteka) —
// zvonček in Naročila jo uvozita. Brez novih tokenov: roksal-red družina
// (roksal-red/30 obroba + roksal-red/10 površina + roksal-red tekst — ISTA
// struktura kot sorojenika; barva ni edini nosilec — badge nosi tudi
// dobeseden tekst 'Pretekel rok').
export function BadgeZamujenaDobava() {
  return (
    <span className="ml-1.5 shrink-0 rounded border border-roksal-red/30 bg-roksal-red/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-roksal-red">
      Pretekel rok
    </span>
  )
}
