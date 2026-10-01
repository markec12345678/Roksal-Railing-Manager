// R340 — dekompozicija calculator-tab FAZA 4 (KOLIZIJA #14: delta prenesena s R339): getCutList + getPostPositions
// izluščeni iz calculator-tab.tsx (vzorec R325 pdf-exports: telesa VERBATIM,
// closure dostop do stanja → eksplicitni args objekti — čiste projekcije
// posredovanega stanja). Brez 'use client' — čisti izračun brez Reacta.

import type { CalcResult } from './shared'

/** Pozicije rezanja letvic (razrezni list): [{num, type, startPosMm, widthMm}]. */
export function getCutList({
  railingResult,
  effectiveTotalLength,
  slatWidth,
}: {
  railingResult: CalcResult | null
  effectiveTotalLength: string
  slatWidth: string
}): { num: number; type: 'razmik' | 'letva'; startPosMm: number; widthMm: number }[] {
  if (!railingResult) return []
  const L = parseFloat(effectiveTotalLength) * 1000
  const W = parseFloat(slatWidth)
  const gap = railingResult.actualGapMm
  const positions: { num: number; type: 'razmik' | 'letva'; startPosMm: number; widthMm: number }[] = []
  let pos = gap // first gap
  for (let i = 0; i < railingResult.slatCount; i++) {
    positions.push({ num: i + 1, type: 'letva', startPosMm: Math.round(pos), widthMm: W })
    pos += W + gap
  }
  return positions
}

/** Pozicije stebrov (enakomerna razdelitev po dolžini). */
export function getPostPositions({
  railingResult,
  effectiveTotalLength,
  postCount,
}: {
  railingResult: CalcResult | null
  effectiveTotalLength: string
  postCount: string
}): number[] {
  if (!railingResult || !postCount) return []
  const L = parseFloat(effectiveTotalLength) * 1000
  const n = parseInt(postCount)
  if (n < 2) return [0]
  const spacing = L / (n - 1)
  return Array.from({ length: n }, (_, i) => Math.round(i * spacing))
}
