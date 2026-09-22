// Slovenski font za jsPDF — Roboto (subset latin-ext) vgrajen kot base64.
//
// jsPDF-jevi core fonti (Helvetica/Times) so WinAnsi-kodirani in NE podpirajo
// šumnikov (Š Č Ž š č ž) — do tega je prišlo, ker so vsi dosedanji PDF-i
// (zapisnik, ponudba, račun) tiskali "NAROČNIK" kot "NARONIK". Ta modul
// vgradi lahki Roboto subset (latin + latin-ext-A + €, 23 KB na varianto)
// in ga registrira kot "Roboto" normal/bold. Vsi PDF generatorji kličejo
// `registerSloPdfFonts(doc)` in nato uporabljajo `doc.setFont('Roboto', 'normal'|'bold')`.

import jsPDF from 'jspdf'
import { ROBOTO_SL_REGULAR_B64, ROBOTO_SL_BOLD_B64 } from './pdf-sl-font-data'

/** Registriraj Roboto subset v dokumentu — kliči pred prvo setFont. VFS je na dokument, zato registriramo vsakič (idempotentno). */
export function registerSloPdfFonts(doc: jsPDF): void {
  doc.addFileToVFS('RobotoSl-Regular.ttf', ROBOTO_SL_REGULAR_B64)
  doc.addFont('RobotoSl-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('RobotoSl-Bold.ttf', ROBOTO_SL_BOLD_B64)
  doc.addFont('RobotoSl-Bold.ttf', 'Roboto', 'bold')
}

/** Privzeti stil — večina generatorjev takoj po registraciji nastavi font. */
export function applySloFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal', size?: number): void {
  registerSloPdfFonts(doc)
  doc.setFont('Roboto', style)
  if (size !== undefined) doc.setFontSize(size)
}
