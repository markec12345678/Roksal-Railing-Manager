/**
 * PWC ASSET KATALOG — deterministično generira docs/PWC-ASSETS.md IZ
 * data/roksal-catalog.json (issue #11 §6: "katalogiziraj obstoječe ...
 * ne ustvarjaj izmišljenih produktov; neznana vrednost ostane unknown").
 *
 * Enak katalog → ista datoteka (deterministično). Zagon: bun tools/pwc-asset-report.ts
 */
import { writeFileSync } from 'node:fs'
import { listProductDefinitions, productDefinitionChecksum } from '../src/lib/product-sdk/catalog'

const esc = (s: string) => s.replace(/\|/g, '\\|')
const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? 'unknown' : String(v))

async function main(): Promise<void> {
  const defs = listProductDefinitions()
  const lines: string[] = []

  lines.push('# PWC Asset Katalog — Roksal WoodCore (realni produkti)')
  lines.push('')
  lines.push('> GENERIRANO z `bun tools/pwc-asset-report.ts` iz `data/roksal-catalog.json` — ne urejaj ročno.')
  lines.push('> Issue #11 §6: SAMO dejansko obstoječi produkti; neznana vrednost = **unknown** (nikoli ugibanje).')
  lines.push('> Pravice (rights) upravlja Product SDK rights-gate; `pending` = za produkcijo čaka odobritev.')
  lines.push('')
  lines.push(`Število profilov: **${defs.length}** · katalog schema: 1 · generirano: deterministično (brez urnega žiga)`)
  lines.push('')

  for (const d of defs) {
    lines.push(`## ${d.profile.name} (\`${d.id}\`)`)
    lines.push('')
    lines.push(`| Polje | Vrednost |`)
    lines.push(`|---|---|`)
    lines.push(`| kataloški ključ | \`${d.catalogProductId}\` |`)
    lines.push(`| proizvajalec | ${esc(fmt(d.manufacturer))} |`)
    lines.push(`| družina | ${esc(fmt(d.family))} |`)
    lines.push(`| oblika profila | ${esc(fmt(d.profile.shape))} |`)
    lines.push(`| širina lica (mm) | ${fmt(d.profile.faceWidthMm)} |`)
    lines.push(`| debelina (mm) | ${fmt(d.profile.thicknessMm)} |`)
    lines.push(`| standardne dolžine (mm) | ${fmt(d.profile.standardLengthsMm.join(', '))} |`)
    lines.push(`| orientaciji | ${fmt(d.orientations.join(' / '))} |`)
    lines.push(`| montaža — vidnost vijakov | ${esc(fmt(d.mounting.screwVisibility))} |`)
    lines.push(`| montaža — pritrditev | ${esc(fmt(d.mounting.fixing))} |`)
    const h = d.mounting.maxPostSpacingByOrientation
    lines.push(`| max razmak stebrov (H) | ${fmt(h.horizontal.maxSpacingMm)} |`)
    lines.push(`| max razmak stebrov (V) | ${fmt(h.vertical.maxSpacingMm)} |`)
    lines.push(`| kvalifikatorji razmaka | ${d.mounting.postSpacingQualifiers.length > 0 ? esc(d.mounting.postSpacingQualifiers.map((q) => `${q.key}: ${q.maxSpacingMm} mm — \u201c${q.condition}\u201d${q.autoApplied ? ' (auto)' : ''}`).join('; ')) : '\u2014'} |`)
    lines.push(`| max razmak pritrdilnih profilov (V, mm) | ${fmt(d.mounting.maxRailSpacingMm)} |`)
    lines.push(`| razmak desk (mm) | ${d.board.minGapMm}–${d.board.maxGapMm} (prekrivanje: ${d.board.canOverlap ? 'da' : 'ne'}) |`)
    lines.push(`| ročaj | ${d.mounting.handle.available ? `da (${fmt(d.mounting.handle.dimensionMm?.join('×'))} mm${d.mounting.handle.screwsEveryMm ? `, vijaki vsak ${d.mounting.handle.screwsEveryMm} mm` : ''})` : 'ne'} |`)
    lines.push(`| pravice | **${d.rights}** |`)
    lines.push(`| katalog checksum (sha256/16) | \`${productDefinitionChecksum(d)}\` |`)
    lines.push('')

    // Asseti — samo obstoječe poti; missing = unknown
    lines.push('### Asseti')
    lines.push('')
    lines.push(`| Tip | Pot | Status |`)
    lines.push(`|---|---|---|`)
    const assets: Array<[string, string | null]> = [
      ['produkt', d.assets.productImage],
      ['profil', d.assets.profileImage],
      ['tekstura', d.assets.textureImage],
      ['referenca', d.assets.referenceImage],
    ]
    for (const [label, p] of assets) {
      lines.push(`| ${label} | ${p ? `\`${p}\`` : 'unknown'} | ${p ? 'repo (pravice pending)' : '—'} |`)
    }
    lines.push('')

    lines.push('### Barve (katalog paleta)')
    lines.push('')
    lines.push(`| Barva | approxHex |`)
    lines.push(`|---|---|`)
    for (const c of d.material.colors) {
      lines.push(`| ${esc(c.name)} | ${c.approxHex ? `\`${c.approxHex}\`` : 'unknown (uradni podatek ne obstaja)'} |`)
    }
    lines.push('')
    lines.push(`Površina: ${esc(fmt(d.material.surface))} · tekstura: ${d.material.textureImage ? `\`${d.material.textureImage}\`` : 'unknown'} · textureImage je server-side SAMO ob rights: granted.`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  writeFileSync('docs/PWC-ASSETS.md', lines.join('\n'), 'utf8')
  console.log(`docs/PWC-ASSETS.md zapisan (${defs.length} profilov, deterministično).`)
}

main().catch((e) => {
  console.error('pwc-asset-report napaka:', e)
  process.exit(1)
})
