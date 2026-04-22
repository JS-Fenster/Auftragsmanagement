/**
 * IBAN + BIC Validation Utilities
 *
 * - IBAN: ISO 13616 Mod-97-Prüfziffernverfahren (ISO 7064)
 * - BIC: ISO 9362 Format-Check via Regex
 *
 * Gemeldet: Andreas 2026-04-22 — Eingabe-Fehler im Bankverbindungen-Panel
 * vermeiden. Später-Backlog: SEPA-Mandats-Prüfung bei Kunden-Abbuchung.
 */

// IBAN-Länge pro ISO-Landcode (Auswahl relevanter Länder)
const IBAN_LENGTH = {
  DE: 22, AT: 20, CH: 21, LI: 21, NL: 18, BE: 16, FR: 27, IT: 27,
  ES: 24, PT: 25, LU: 20, DK: 18, SE: 24, NO: 15, FI: 18, PL: 28,
  CZ: 24, SK: 24, HU: 28, SI: 19, HR: 21, GB: 22, IE: 22,
}

/**
 * Normalisiert eine IBAN: entfernt Leerzeichen + uppercase.
 */
export function normalizeIBAN(iban) {
  return (iban || '').replace(/\s+/g, '').toUpperCase()
}

/**
 * Formatiert eine IBAN in 4er-Gruppen zur Anzeige.
 * Beispiel: "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00"
 */
export function formatIBAN(iban) {
  const clean = normalizeIBAN(iban)
  return clean.match(/.{1,4}/g)?.join(' ') || ''
}

/**
 * IBAN-Validierung via Mod-97-Prüfziffernverfahren (ISO 7064).
 *
 * Schritte:
 *   1. Leerzeichen entfernen + uppercase
 *   2. Format-Check (Landcode + Prüfziffern + Rest, min. 15 Zeichen)
 *   3. Länder-spezifische Länge prüfen (wenn bekannt)
 *   4. Buchstaben zu Zahlen (A=10, B=11, ..., Z=35)
 *   5. Landcode+Prüfziffern ans Ende verschieben
 *   6. Als große Zahl mod 97 → muss 1 ergeben
 *
 * @returns {{valid: boolean, error?: string, country?: string}}
 */
export function validateIBAN(iban) {
  const clean = normalizeIBAN(iban)

  if (!clean) return { valid: false, error: 'IBAN fehlt' }

  // Grundformat: 2 Buchstaben + 2 Ziffern + mind. 11 alphanumerisch
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) {
    return { valid: false, error: 'Ungültiges IBAN-Format (erwartet: 2 Buchstaben Land + 2 Prüfziffern + Kontonummer)' }
  }

  const country = clean.substring(0, 2)
  const expectedLength = IBAN_LENGTH[country]

  if (expectedLength && clean.length !== expectedLength) {
    return { valid: false, error: `IBAN für ${country} muss ${expectedLength} Zeichen lang sein (aktuell ${clean.length})` }
  }

  // Mod-97-Verfahren: ersten 4 Zeichen ans Ende, Buchstaben → Zahlen, mod 97 == 1
  const rearranged = clean.substring(4) + clean.substring(0, 4)
  let numeric = ''
  for (const char of rearranged) {
    if (/[A-Z]/.test(char)) {
      numeric += (char.charCodeAt(0) - 55).toString() // A=10, B=11, ..., Z=35
    } else {
      numeric += char
    }
  }

  // Big-Integer-Mod-97 in Chunks (JS-Number hat nur 15 Stellen Präzision)
  let remainder = 0
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.substring(i, i + 7)
    remainder = parseInt(chunk, 10) % 97
  }

  if (remainder !== 1) {
    return { valid: false, error: 'IBAN-Prüfziffer ungültig (Mod-97-Check fehlgeschlagen)' }
  }

  return { valid: true, country }
}

/**
 * BIC-Validierung via ISO 9362 Format-Check.
 *
 * Format: BANKCODE(4) + COUNTRY(2) + LOCATION(2) + [BRANCH(3)]
 *   - Bankcode: 4 Großbuchstaben
 *   - Country: ISO-Ländercode (2 Großbuchstaben)
 *   - Location: 2 alphanumerisch
 *   - Branch: optional 3 alphanumerisch (meist "XXX" für Hauptstelle)
 *
 * Beispiel: "COBADEFFXXX" oder "COBADEFF"
 *
 * @returns {{valid: boolean, error?: string}}
 */
export function validateBIC(bic) {
  const clean = (bic || '').replace(/\s+/g, '').toUpperCase()

  if (!clean) return { valid: false, error: 'BIC fehlt' }

  if (clean.length !== 8 && clean.length !== 11) {
    return { valid: false, error: `BIC muss 8 oder 11 Zeichen lang sein (aktuell ${clean.length})` }
  }

  if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(clean)) {
    return { valid: false, error: 'Ungültiges BIC-Format (erwartet: 4 Bank + 2 Land + 2 Ort + optional 3 Filiale)' }
  }

  return { valid: true }
}

/**
 * Kombinierte Prüfung — praktisch für Bankverbindungs-Forms.
 */
export function validateBankverbindung({ iban, bic }) {
  const errors = {}
  const ibanResult = validateIBAN(iban)
  if (!ibanResult.valid) errors.iban = ibanResult.error
  const bicResult = validateBIC(bic)
  if (!bicResult.valid) errors.bic = bicResult.error
  return { valid: Object.keys(errors).length === 0, errors }
}
