/** Checksum validators for IBAN (ISO 13616) and ISIN (ISO 6166). */

/** Removes spaces and upper-cases an IBAN. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** True if the IBAN has a valid structure and mod-97 checksum. */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
}

/** True if the ISIN has 2 letters, 9 alphanumerics and a valid Luhn check digit. */
export function isValidIsin(value: string): boolean {
  const isin = value.trim().toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false
  const expanded = isin
    .slice(0, 11)
    .split('')
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join('')
  let sum = 0
  // Luhn from the right; the check digit is appended, so double every second digit starting at the rightmost.
  for (let i = 0; i < expanded.length; i++) {
    let digit = Number(expanded[expanded.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  const check = (10 - (sum % 10)) % 10
  return check === Number(isin[11])
}
