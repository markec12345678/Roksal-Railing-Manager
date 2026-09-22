/**
 * eSlog 2.1 eRačun — UBL 2.1 XML (EN 16931) za slovenski eRačun sistem.
 *
 * Vir: raziskava runda A-D (MJU / eRačun.si — javni naročnik je obvezen
 * prejemnik eRačunov). Generiramo samostojen XML, ki ga podjetje odda prek
 * svojega ponudnika eRačun storitve (Gateway, eRačun.si, Čebelica …).
 * Struktura: EN 16931 core invoice model v UBL 2.1 sintaksi, valuta EUR,
 * plačilo po TRR (PaymentMeansCode 30 = kreditni prenos), DDV po stopnjah.
 */

export interface EslogPostavka {
  opis: string
  kolicina: number
  enota: string
  cenaNaEnoto: number
  ddvStopnja: number
}

export interface EslogKupec {
  ime: string
  naslov: string
  telefon?: string | null
  email?: string | null
  davcnaSt?: string | null
}

export interface EslogInvoice {
  stevilka: string
  tip: 'PREDRACUN' | 'RACUN' | 'PREDPLACILNI'
  datumIzdaje: string
  datumStoritve: string | null
  rokPlacilaDni: number
  postavke: EslogPostavka[]
  kupec: EslogKupec | null
  osnova: number
  ddv: number
  znesek: number
  opombe: string | null
}

const IZDAJATELJ = {
  naziv: 'Roksal d.o.o.',
  naslov: 'Cesta Republike 14',
  posta: '4000 Kranj',
  davcna: '12345678', // bez predpone SI — SchemeID
  trr: 'SI56020100012345678',
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const num = (n: number): string => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2)

const iso = (d: Date): string => d.toISOString().slice(0, 10)

/** Razdeli "Ljubljanska cesta 142, 4000 Kranj" → [ulica, kraj, postnaStevilka]. */
function splitNaslov(naslov: string): { ulica: string; kraj: string; posta: string } {
  const delovi = naslov.split(',').map((p) => p.trim()).filter(Boolean)
  if (delovi.length >= 2) {
    const postniKraj = delovi[delovi.length - 1]
    const m = postniKraj.match(/^(\d{4})\s+(.+)$/)
    if (m) return { ulica: delovi.slice(0, -1).join(', '), posta: m[1], kraj: m[2] }
    return { ulica: delovi.slice(0, -1).join(', '), posta: '', kraj: postniKraj }
  }
  return { ulica: naslov.trim(), posta: '', kraj: '' }
}

/** Trenutni datum kot YYYY-MM-DD (za IssueDate default). */
export function buildUblInvoiceXml(inv: EslogInvoice): string {
  const postavke = inv.postavke
  const kupec = inv.kupec
  const rok = new Date(inv.datumIzdaje)
  rok.setDate(rok.getDate() + inv.rokPlacilaDni)

  // DDV skupine po stopnjah
  const ddvSkupine = new Map<number, { osnova: number; ddv: number }>()
  for (const p of postavke) {
    const vrstica = Math.round(p.kolicina * p.cenaNaEnoto * 100) / 100
    const g = ddvSkupine.get(p.ddvStopnja) ?? { osnova: 0, ddv: 0 }
    g.osnova = Math.round((g.osnova + vrstica) * 100) / 100
    g.ddv = Math.round((g.ddv + vrstica * (p.ddvStopnja / 100)) * 100) / 100
    ddvSkupine.set(p.ddvStopnja, g)
  }

  const izdOsnova = splitNaslov(IZDAJATELJ.naslov + ', ' + IZDAJATELJ.posta)
  const kuNaslov = kupec ? splitNaslov(kupec.naslov) : { ulica: '', posta: '', kraj: '' }

  const L: string[] = []
  L.push('<?xml version="1.0" encoding="UTF-8"?>')
  L.push('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"')
  L.push('         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"')
  L.push('         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">')

  // Metapodatki dokumenta
  L.push('  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>')
  L.push('  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>')
  L.push(`  <cbc:ID>${esc(inv.stevilka)}</cbc:ID>`)
  L.push(`  <cbc:IssueDate>${iso(new Date(inv.datumIzdaje))}</cbc:IssueDate>`)
  L.push(`  <cbc:DueDate>${iso(rok)}</cbc:DueDate>`)
  L.push(`  <cbc:InvoiceTypeCode>${inv.tip === 'PREDPLACILNI' ? '386' : inv.tip === 'PREDRACUN' ? '325' : '380'}</cbc:InvoiceTypeCode>`)
  L.push('  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>')
  if (inv.opombe) L.push(`  <cbc:Note>${esc(inv.opombe)}</cbc:Note>`)
  if (inv.datumStoritve) {
    L.push('  <cac:Delivery>')
    L.push(`    <cbc:ActualDeliveryDate>${iso(new Date(inv.datumStoritve))}</cbc:ActualDeliveryDate>`)
    L.push('  </cac:Delivery>')
  }

  // Izdajatelj (AccountingSupplierParty)
  L.push('  <cac:AccountingSupplierParty>')
  L.push('    <cac:Party>')
  L.push(`      <cbc:EndpointID schemeID="9957">${esc(IZDAJATELJ.davcna)}</cbc:EndpointID>`) // 9957 = SI davčna
  L.push('      <cac:PostalAddress>')
  L.push(`        <cbc:StreetName>${esc(izdOsnova.ulica)}</cbc:StreetName>`)
  L.push(`        <cbc:CityName>${esc(izdOsnova.kraj)}</cbc:CityName>`)
  L.push(`        <cbc:PostalZone>${esc(izdOsnova.posta)}</cbc:PostalZone>`)
  L.push('        <cac:Country>')
  L.push('          <cbc:IdentificationCode listID="ISO3166-1:Alpha2">SI</cbc:IdentificationCode>')
  L.push('        </cac:Country>')
  L.push('      </cac:PostalAddress>')
  L.push('      <cac:PartyTaxScheme>')
  L.push(`        <cbc:CompanyID schemeID="SI">${esc(IZDAJATELJ.davcna)}</cbc:CompanyID>`)
  L.push('        <cac:TaxScheme>')
  L.push('          <cbc:ID>VAT</cbc:ID>')
  L.push('        </cac:TaxScheme>')
  L.push('      </cac:PartyTaxScheme>')
  L.push('      <cac:PartyLegalEntity>')
  L.push(`        <cbc:RegistrationName>${esc(IZDAJATELJ.naziv)}</cbc:RegistrationName>`)
  L.push(`        <cbc:CompanyID>${esc(IZDAJATELJ.davcna)}</cbc:CompanyID>`)
  L.push('      </cac:PartyLegalEntity>')
  L.push('      <cac:Contact>')
  L.push('        <cbc:ElectronicMail>info@roksal.si</cbc:ElectronicMail>')
  L.push('      </cac:Contact>')
  L.push('    </cac:Party>')
  L.push('  </cac:AccountingSupplierParty>')

  // Kupec (AccountingCustomerParty)
  L.push('  <cac:AccountingCustomerParty>')
  L.push('    <cac:Party>')
  if (kupec) {
    L.push('      <cac:PostalAddress>')
    L.push(`        <cbc:StreetName>${esc(kuNaslov.ulica)}</cbc:StreetName>`)
    L.push(`        <cbc:CityName>${esc(kuNaslov.kraj)}</cbc:CityName>`)
    if (kuNaslov.posta) L.push(`        <cbc:PostalZone>${esc(kuNaslov.posta)}</cbc:PostalZone>`)
    L.push('        <cac:Country>')
    L.push('          <cbc:IdentificationCode listID="ISO3166-1:Alpha2">SI</cbc:IdentificationCode>')
    L.push('        </cac:Country>')
    L.push('      </cac:PostalAddress>')
    if (kupec.email) {
      L.push('      <cac:Contact>')
      L.push(`        <cbc:ElectronicMail>${esc(kupec.email)}</cbc:ElectronicMail>`)
      L.push('      </cac:Contact>')
    }
    if (kupec.davcnaSt) {
      const davcnaClean = kupec.davcnaSt.replace(/\s+/g, '').replace(/^SI/, '')
      L.push('      <cac:PartyTaxScheme>')
      L.push(`        <cbc:CompanyID>${esc(davcnaClean)}</cbc:CompanyID>`)
      L.push('        <cac:TaxScheme>')
      L.push('          <cbc:ID>VAT</cbc:ID>')
      L.push('        </cac:TaxScheme>')
      L.push('      </cac:PartyTaxScheme>')
    }
    L.push('      <cac:PartyLegalEntity>')
    L.push(`        <cbc:RegistrationName>${esc(kupec.ime)}</cbc:RegistrationName>`)
    L.push('      </cac:PartyLegalEntity>')
  } else {
    L.push('      <cac:PartyLegalEntity>')
    L.push('        <cbc:RegistrationName>Neznan kupec</cbc:RegistrationName>')
    L.push('      </cac:PartyLegalEntity>')
  }
  L.push('    </cac:Party>')
  L.push('  </cac:AccountingCustomerParty>')

  // Plačilo: kreditni prenos na TRR izdajatelja + referenca
  L.push('  <cac:PaymentMeans>')
  L.push('    <cbc:PaymentMeansCode name="creditTransfer">30</cbc:PaymentMeansCode>')
  if (inv.stevilka) {
    L.push('    <cbc:PaymentID>SI12 ' + esc(inv.stevilka) + '</cbc:PaymentID>')
  }
  L.push('    <cac:PayeeFinancialAccount>')
  L.push(`      <cbc:ID>${esc(IZDAJATELJ.trr)}</cbc:ID>`)
  L.push(`      <cbc:Name>${esc(IZDAJATELJ.naziv)}</cbc:Name>`)
  L.push('    </cac:PayeeFinancialAccount>')
  L.push('  </cac:PaymentMeans>')

  // DDV skupine
  L.push('  <cac:TaxTotal>')
  L.push(`    <cbc:TaxAmount currencyID="EUR">${num(inv.ddv)}</cbc:TaxAmount>`)
  for (const [stopnja, g] of ddvSkupine) {
    L.push('    <cac:TaxSubtotal>')
    L.push(`      <cbc:TaxableAmount currencyID="EUR">${num(g.osnova)}</cbc:TaxableAmount>`)
    L.push(`      <cbc:TaxAmount currencyID="EUR">${num(g.ddv)}</cbc:TaxAmount>`)
    L.push('      <cac:TaxCategory>')
    L.push(`        <cbc:ID>${stopnja === 0 ? 'E' : 'S'}</cbc:ID>`)
    L.push(`        <cbc:Percent>${num(stopnja)}</cbc:Percent>`)
    L.push('        <cac:TaxScheme>')
    L.push('          <cbc:ID>VAT</cbc:ID>')
    L.push('        </cac:TaxScheme>')
    L.push('      </cac:TaxCategory>')
    L.push('    </cac:TaxSubtotal>')
  }
  L.push('  </cac:TaxTotal>')

  // Vsote dokumenta
  L.push('  <cac:LegalMonetaryTotal>')
  L.push(`    <cbc:LineExtensionAmount currencyID="EUR">${num(inv.osnova)}</cbc:LineExtensionAmount>`)
  L.push(`    <cbc:TaxExclusiveAmount currencyID="EUR">${num(inv.osnova)}</cbc:TaxExclusiveAmount>`)
  L.push(`    <cbc:TaxInclusiveAmount currencyID="EUR">${num(inv.znesek)}</cbc:TaxInclusiveAmount>`)
  L.push(`    <cbc:PayableAmount currencyID="EUR">${num(inv.znesek)}</cbc:PayableAmount>`)
  L.push('  </cac:LegalMonetaryTotal>')

  // Postavke
  postavke.forEach((p, i) => {
    const vrstica = Math.round(p.kolicina * p.cenaNaEnoto * 100) / 100
    L.push('  <cac:InvoiceLine>')
    L.push(`    <cbc:ID>${i + 1}</cbc:ID>`)
    L.push(`    <cbc:InvoicedQuantity unitCode="${esc(p.enota.toUpperCase().slice(0, 5))}">${esc(String(p.kolicina))}</cbc:InvoicedQuantity>`)
    L.push(`    <cbc:LineExtensionAmount currencyID="EUR">${num(vrstica)}</cbc:LineExtensionAmount>`)
    L.push('    <cac:Item>')
    L.push(`      <cbc:Name>${esc(p.opis)}</cbc:Name>`)
    L.push('      <cac:ClassifiedTaxCategory>')
    L.push(`        <cbc:ID>${p.ddvStopnja === 0 ? 'E' : 'S'}</cbc:ID>`)
    L.push(`        <cbc:Percent>${num(p.ddvStopnja)}</cbc:Percent>`)
    L.push('        <cac:TaxScheme>')
    L.push('          <cbc:ID>VAT</cbc:ID>')
    L.push('        </cac:TaxScheme>')
    L.push('      </cac:ClassifiedTaxCategory>')
    L.push('    </cac:Item>')
    L.push('    <cac:Price>')
    L.push(`      <cbc:PriceAmount currencyID="EUR">${num(p.cenaNaEnoto)}</cbc:PriceAmount>`)
    L.push('    </cac:Price>')
    L.push('  </cac:InvoiceLine>')
  })

  L.push('</Invoice>')
  return L.join('\n')
}
