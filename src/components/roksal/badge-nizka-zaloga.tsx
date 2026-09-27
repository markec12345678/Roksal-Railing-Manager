// R219 — EN VIR badgea 'Nizka zaloga' (izluščena iz command-palette.tsx R218).
// ---------------------------------------------------------------------------
// R218 je badge vpeljala kot lokalno komponento v paleti (iskalni Material
// zadetek + zgodovina = ISTI vizual). R219 (P1-e) — zvonček digest je PETI
// signalec konvergence: stock vrstice v zvončku nosijo ISTI badge. Da so vsi
// signalleri VIDA enako, je definicija TOČNO ENKRAT (ta datoteka) — paleta in
// zvonček je uvozita. Brez novih tokenov: roksal-red družina (roksal-red/30
// obroba + roksal-red/10 površina + roksal-red tekst — ISTI razredi kot R218;
// barva ni edini nosilec — badge nosi tudi dobeseden tekst 'Nizka zaloga').
export function BadgeNizkaZaloga() {
  return (
    <span className="ml-1.5 shrink-0 rounded border border-roksal-red/30 bg-roksal-red/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-roksal-red">
      Nizka zaloga
    </span>
  )
}
