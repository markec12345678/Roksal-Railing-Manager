// R222 — EN VIR badgea 'Brez dobavitelja' (sorojenik BadgeNizkaZaloga R219).
// ---------------------------------------------------------------------------
// R221 je 'brez dobavitelja' vpeljala kot čip + paleto skupino v Zalogi
// (roksal-amber družina — DRUGA dimenzija: nabavna pripravljenost; rdeča
// ostane rezervirana nizki zalogi). R222 — druga dimenzija dobi glas TUDI
// v obstoječih signalcih konvergence: iskalni Material zadetek (⌘K),
// zgodovina iskanja (⌘K 'Nedavna iskanja') in zvonček digest (vrstice
// artiklov brez vpisane cene). Da so vsi signalci VIDA enako, je definicija
// TOČNO ENKRAT (ta datoteka) — paleta in zvonček jo uvozita. Brez novih
// tokenov: roksal-amber družina (roksal-amber/30 obroba + roksal-amber/10
// površina + roksal-amber tekst — ISTA struktura kot BadgeNizkaZaloga;
// barva ni edini nosilec — badge nosi tudi dobeseden tekst 'Brez
// dobavitelja').
export function BadgeBrezDobavitelja() {
  return (
    <span className="ml-1.5 shrink-0 rounded border border-roksal-amber/30 bg-roksal-amber/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-roksal-amber">
      Brez dobavitelja
    </span>
  )
}
