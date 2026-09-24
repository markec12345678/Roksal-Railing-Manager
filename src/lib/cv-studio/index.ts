/**
 * CV STUDIO SDK (issues #10 + #11) — javni API (CLIENT-SAFE del).
 *
 * Strežniški moduli (node:crypto / sharp) se uvažajo DIREKTNO po poti:
 *   import { analyzeScene } from '@/lib/cv-studio/scene'          // server
 *   import { evaluatePlacement, projectPlacement } from '@/lib/cv-studio/placement' // server (Product SDK katalog)
 *   import { decodeImageToImageBuffer } from '@/lib/cv-studio/decode' // server
 *
 * Klient uporablja: tipe + capabilities + API pozive (/api/vision/*) —
 * placement je strežnik-avtoritativen (Product SDK katalog gre vedno prek
 * strežnika, spec §21).
 */
export * from './types'
export * from './quality'
export * from './capabilities'
