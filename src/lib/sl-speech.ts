'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Glasovni vnos meritev v slovenščini (Web Speech API, Chrome/Edge/Android).
 *
 * Primeri, ki jih parser razume:
 *  "dva metra štirideset"            → 2400 mm (2 m + 40 cm)
 *  "triinšestdeset centimetrov"      → 630 mm
 *  "devetsto"                        → 900 mm
 *  "2,4 metra"                       → 2400 mm
 *  "dva tisoč štiristo"              → 2400 mm
 *  "tisoč dvaindvajset"              → 1021 mm
 *  "2400"                            → 2400 mm (številka = aktivna enota)
 *
 * Rezultat je VEDNO v mm; klicatelj ga pretvori v aktivno enoto obrazca.
 */

// ── Slovenske številke 0–9999 ────────────────────────────────────────────────

const UNITS: Record<string, number> = {
  ena: 1, ena_: 1, dva: 2, dve: 2, tri: 3, štiri: 4, stiri: 4, pet: 5,
  šest: 6, sest: 6, sedem: 7, osem: 8, devet: 9,
}

const SPECIAL: Record<string, number> = {
  deset: 10, enajst: 11, dvanajst: 12, trinajst: 13, štirinajst: 14, stirinajst: 14,
  petnajst: 15, šestnajst: 16, sestnajst: 16, sedemnajst: 17, osemnajst: 18, devetnajst: 19,
}

const TENS: Record<string, number> = {
  dvajset: 20, trideset: 30, štirideset: 40, stirideset: 40, petdeset: 50,
  šestdeset: 60, sestdeset: 60, sedemdeset: 70, osemdeset: 80, devetdeset: 90,
}

const HUNDREDS: Record<string, number> = {
  sto: 100, dvesto: 200, tristo: 300, štiristo: 400, stiristo: 400,
  petsto: 500, šeststo: 600, seststo: 600, sedemsto: 700, osemsto: 800, devetsto: 900,
}

const UNIT_WORDS_MM: Record<string, number> = {
  // metri
  metar: 1000, metra: 1000, metrov: 1000, meter: 1000, metre: 1000,
  // centimetri
  centimeter: 10, centimetra: 10, centimetrov: 10, centimetre: 10, centi: 10,
  // milimetri
  milimeter: 1, milimetra: 1, milimetrov: 1, milimetri: 1, milimetre: 1,
}

function parseCompoundToken(tok: string): number | null {
  // "triintrideset" / "dvaindvajset" → enota + in + desetica
  const inIdx = tok.indexOf('in')
  if (inIdx > 0) {
    const head = tok.slice(0, inIdx)
    const tail = tok.slice(inIdx + 2)
    const u = UNITS[head]
    const t = TENS[tail]
    if (u !== undefined && t !== undefined) return u + t
  }
  return null
}

/** Razčleni en token kot številski prispevek ali null. */
function parseNumberToken(tok: string): number | null {
  if (tok in SPECIAL) return SPECIAL[tok]
  if (tok in TENS) return TENS[tok]
  if (tok in HUNDREDS) return HUNDREDS[tok]
  const u = UNITS[tok]
  if (u !== undefined) return u
  const compound = parseCompoundToken(tok)
  if (compound !== null) return compound
  if (tok === 'tisoč' || tok === 'tisoc' || tok === 'tisoča') return -1000 // marker
  return null
}

/**
 * Pretvori govorni prepis v milimetre.
 * @param transcript prepis (npr. "dva metra štirideset")
 * @param fallbackUnit enota za gole številke ("2400" → mm, če je aktivna enota mm)
 */
export function parseSlDimension(transcript: string, fallbackUnit: 'mm' | 'cm' | 'm' = 'mm'): number | null {
  if (!transcript) return null
  const text = transcript.toLowerCase().replace(/[!?;]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null

  // Decimalna številka z enoto: "2,4 metra" / "0.9 m" (vejica/pika med ciframi)
  const decimal = text.match(/(\d+)[.,](\d+)\s*(metar|metra|metrov|meter|centimetrov|centimetra|centimeter|milimetrov|milimetra|milimeter|centi|m\b|cm\b|mm\b)?/)
  if (decimal) {
    const whole = parseInt(decimal[1], 10)
    const frac = parseInt(decimal[2], 10) / Math.pow(10, decimal[2].length)
    const raw = whole + frac
    const unit = decimal[3]?.trim()
    let mm: number
    if (!unit || unit.startsWith('met') || unit === 'm') mm = raw * 1000
    else if (unit === 'cm' || unit.startsWith('cent')) mm = raw * 10
    else mm = raw
    return Math.round(mm)
  }

  // Tokeni — odstrani ločila s robovov besed (ne med številkami, tista je zgoraj)
  const tokens = text
    .split(' ')
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)

  const mmParts: number[] = []
  let current = 0               // akumulirana številka brez enote
  let lastUnitWasMeters = false // "dva metra štirideset" → 40 = cm
  let pendingBare: { value: number; afterMeters: boolean } | null = null

  const flushBareLocal = (b: { value: number; afterMeters: boolean }, explicitUnitMm?: number) => {
    if (explicitUnitMm) return b.value * explicitUnitMm
    if (b.afterMeters) return b.value * 10 // cm po metrih
    return b.value * (fallbackUnit === 'm' ? 1000 : fallbackUnit === 'cm' ? 10 : 1)
  }

  for (const tok of tokens) {
    // Gole številke ("2400", "300")
    if (/^\d+$/.test(tok)) {
      if (pendingBare) mmParts.push(flushBareLocal(pendingBare))
      pendingBare = { value: parseInt(tok, 10), afterMeters: lastUnitWasMeters }
      continue
    }

    // Enote ("metra", "centimetrov", …)
    if (tok in UNIT_WORDS_MM) {
      const unitMm = UNIT_WORDS_MM[tok]
      if (pendingBare) {
        // "2400 milimetrov" — številka + eksplicitna enota
        mmParts.push(flushBareLocal(pendingBare, unitMm))
        pendingBare = null
      } else {
        // "metra" brez števca → 1 enota; "dva metra" → 2 enote
        mmParts.push((current || 1) * unitMm)
        current = 0
      }
      lastUnitWasMeters = unitMm === 1000
      continue
    }

    // Številski besedni tokeni
    const n = parseNumberToken(tok)
    if (n !== null) {
      if (n === -1000) {
        // "tisoč": pomnoži akumulirano (ali 1) in pošlji v milimetrih
        mmParts.push((current || 1) * 1000)
        current = 0
        lastUnitWasMeters = false
        continue
      }
      if (pendingBare) mmParts.push(flushBareLocal(pendingBare))
      pendingBare = null
      current += n
      continue
    }
    // neznan token — ignoriraj ("je", "približno" …)
  }
  if (pendingBare) mmParts.push(flushBareLocal(pendingBare))
  if (current > 0) {
    // številka brez enote na koncu: po metrih pomeni cm, sicer fallback enota
    const scale = lastUnitWasMeters ? 10 : fallbackUnit === 'm' ? 1000 : fallbackUnit === 'cm' ? 10 : 1
    mmParts.push(current * scale)
  }

  const total = mmParts.reduce((a, b) => a + b, 0)
  return mmParts.length > 0 && total > 0 ? Math.round(total) : null
}

// ── Web Speech hook ──────────────────────────────────────────────────────────

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
  length: number
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [i: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export function useSpeechRecognition(onFinal: (transcript: string) => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  const supported =
    typeof window !== 'undefined' &&
    !!((window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition)

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!supported) return
    try {
      const Ctor =
        (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
      if (!Ctor) return
      const rec = new Ctor()
      rec.lang = 'sl-SI'
      rec.continuous = false
      rec.interimResults = true
      rec.onresult = (e: SpeechRecognitionEventLike) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            const t = e.results[i][0].transcript
            onFinalRef.current(t)
          }
        }
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recRef.current = rec
      rec.start()
      setListening(true)
      try { navigator.vibrate?.(20) } catch { /* ignore */ }
    } catch {
      setListening(false)
    }
  }, [supported])

  useEffect(() => () => { try { recRef.current?.stop() } catch { /* ignore */ } }, [])

  return { supported, listening, start, stop }
}
