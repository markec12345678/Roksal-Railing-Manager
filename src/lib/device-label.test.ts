// R137 — device-label: deterministično razčlenjanje User-Agent za UI
// "Aktivne seje". Kontrakt: isti niz → isti opis; neznani vhod → izrecno
// "Neznan …" (brez izmišljanja podatkov); izhod NIKOLI ne vsebuje dela
// surovega vhoda (varnost: UA je tuji niz).

import { describe, expect, it } from 'vitest'
import { describeDevice, deviceLabelLine } from './device-label'

describe('describeDevice — naprava', () => {
  it('iPhone → Telefon · iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    expect(describeDevice(ua)).toEqual({
      device: 'Telefon',
      os: 'iOS',
      browser: 'Safari',
    })
  })

  it('Android telefon (nosi Mobile) → Telefon · Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
    expect(describeDevice(ua)).toEqual({
      device: 'Telefon',
      os: 'Android',
      browser: 'Chrome',
    })
  })

  it('Android tablica (BREZ Mobile) → Tablica · Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    expect(describeDevice(ua).device).toBe('Tablica')
    expect(describeDevice(ua).os).toBe('Android')
  })

  it('iPad → Tablica · iOS (tudi če Safari kot desktop Mac)', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    expect(describeDevice(ua)).toEqual({
      device: 'Tablica',
      os: 'iOS',
      browser: 'Safari',
    })
  })

  it('Windows desktop → Računalnik · Windows · Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    expect(describeDevice(ua)).toEqual({
      device: 'Računalnik',
      os: 'Windows',
      browser: 'Chrome',
    })
  })

  it('macOS → Računalnik · macOS · Safari', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    expect(describeDevice(ua)).toEqual({
      device: 'Računalnik',
      os: 'macOS',
      browser: 'Safari',
    })
  })

  it('Linux → Računalnik · Linux (X11 tudi)', () => {
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/127.0').os).toBe('Linux')
  })
})

describe('describeDevice — brskalnik (vrstni red pravil)', () => {
  const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'

  it('Edge → Edge, NE Chrome (Edge nosi tudi Chrome token)', () => {
    expect(describeDevice(`${win} Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0`).browser).toBe('Edge')
  })

  it('Opera → Opera, NE Chrome (OPR/ token)', () => {
    expect(describeDevice(`${win} Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0`).browser).toBe('Opera')
  })

  it('Samsung Internet → Samsung Internet (pred Chrome)', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'
    expect(describeDevice(ua).browser).toBe('Samsung Internet')
  })

  it('Firefox → Firefox (svoj token)', () => {
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0').browser).toBe('Firefox')
  })

  it('iOS Chrome (CriOS) → Chrome, NE Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.37 Mobile/15E148 Safari/604.1'
    expect(describeDevice(ua).browser).toBe('Chrome')
  })

  it('iOS Firefox (FxiOS) → Firefox', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15'
    expect(describeDevice(ua).browser).toBe('Firefox')
  })

  it('Safari zahteva Version/ token (Chrome pošilja tudi "Safari")', () => {
    // Chrome brez Edg/OPR — "Safari" token je prisoten, a Version/ ni.
    expect(describeDevice(`${win} Chrome/126.0.0.0 Safari/537.36`).browser).toBe('Chrome')
  })
})

describe('describeDevice — neznani vhodi (fail-verbose, brez izmišljanja)', () => {
  it('null/undefined → Neznana naprava', () => {
    expect(describeDevice(null)).toEqual({
      device: 'Neznana naprava',
      os: 'Neznan sistem',
      browser: 'Neznan brskalnik',
    })
    expect(describeDevice(undefined).device).toBe('Neznana naprava')
  })

  it('prazen in presledki → Neznana naprava', () => {
    expect(describeDevice('')).toEqual(describeDevice('   '))
  })

  it('prekomerno dolg UA (>512) → Neznana naprava (odloži fingerprint poskuse)', () => {
    expect(describeDevice('x'.repeat(513)).device).toBe('Neznana naprava')
  })

  it('neznani a veljaven UA → izrecno Neznan …, NE izmišljen podatek', () => {
    const d = describeDevice('NekaBudocaAplikacija/1.0')
    expect(d).toEqual({
      device: 'Računalnik',
      os: 'Neznan sistem',
      browser: 'Neznan brskalnik',
    })
  })

  it('izhod NIKOLI ne vsebuje dela surovega UA (tuji niz ne pride skozi)', () => {
    const hostile = 'ZZZ-Agent/9 (Chrome/999, Safari/999, Injekcija<script>)'
    const line = deviceLabelLine(hostile)
    expect(line).not.toContain('Injekcija')
    expect(line).not.toContain('<script>')
    expect(line).toBe('Računalnik · Neznan sistem · Chrome')
  })
})

describe('deviceLabelLine — enovrstični prikaz', () => {
  it('determinizem: isti niz → isti niz (2×)', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    expect(deviceLabelLine(ua)).toBe('Računalnik · Windows · Chrome')
    expect(deviceLabelLine(ua)).toBe(deviceLabelLine(ua))
  })
})
