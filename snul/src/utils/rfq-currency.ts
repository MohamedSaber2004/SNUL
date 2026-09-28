export interface RfqItemCurrencyMeta {
  hasConversion: boolean
  baseCurrency?: string
  requestedCurrency?: string
  basePrice?: number
  requestedPrice?: number
  rate?: number
  cleanNote?: string
}

export interface RfqHeaderCurrencyMeta {
  hasConversion: boolean
  requestedCurrency?: string
  baseCurrency?: string
  cleanNote?: string
}

const ITEM_CURRENCY_REGEX = /\[CURRENCY_REQUEST:\s*BASE=([\d.]+)\s*([A-Za-z]{3})\s*\|\s*REQUESTED=([\d.]+)\s*([A-Za-z]{3})(?:\s*\|\s*RATE=([\d.]+))?\]/
const HEADER_CURRENCY_REGEX = /\[REQUESTED_CURRENCY:\s*([A-Za-z]{3})(?:\s*\(Base:\s*([A-Za-z]{3})\))?\]/

/**
 * Encodes currency conversion metadata into an RFQ item notes string.
 */
export function formatRfqCurrencyNote(options: {
  baseCurrency: string
  requestedCurrency: string
  basePrice: number
  requestedPrice: number
  rate?: number
  userNote?: string | null
}): string {
  const { baseCurrency, requestedCurrency, basePrice, requestedPrice, rate, userNote } = options
  const bCur = baseCurrency.toUpperCase().trim()
  const rCur = requestedCurrency.toUpperCase().trim()
  const tag = `[CURRENCY_REQUEST: BASE=${basePrice} ${bCur} | REQUESTED=${requestedPrice} ${rCur}${rate ? ` | RATE=${rate}` : ''}]`
  return userNote?.trim() ? `${tag} ${userNote.trim()}` : tag
}

/**
 * Parses currency conversion metadata from an RFQ item notes string.
 */
export function parseRfqCurrencyNote(notes?: string | null): RfqItemCurrencyMeta {
  if (!notes) {
    return { hasConversion: false, cleanNote: '' }
  }

  const match = notes.match(ITEM_CURRENCY_REGEX)
  if (!match) {
    return { hasConversion: false, cleanNote: notes.trim() }
  }

  const basePrice = parseFloat(match[1] || '0')
  const baseCurrency = match[2]?.toUpperCase()
  const requestedPrice = parseFloat(match[3] || '0')
  const requestedCurrency = match[4]?.toUpperCase()
  const rate = match[5] ? parseFloat(match[5]) : undefined
  const cleanNote = notes.replace(match[0], '').trim()

  return {
    hasConversion: Boolean(baseCurrency && requestedCurrency && baseCurrency !== requestedCurrency),
    baseCurrency,
    requestedCurrency,
    basePrice,
    requestedPrice,
    rate,
    cleanNote,
  }
}

/**
 * Encodes requested currency metadata into the top-level RFQ note.
 */
export function formatRfqHeaderCurrencyNote(requestedCurrency: string, baseCurrency: string, userNote?: string | null): string {
  const rCur = requestedCurrency.toUpperCase().trim()
  const bCur = baseCurrency.toUpperCase().trim()
  const tag = `[REQUESTED_CURRENCY: ${rCur} (Base: ${bCur})]`
  return userNote?.trim() ? `${tag}\n${userNote.trim()}` : tag
}

/**
 * Parses requested currency metadata from the top-level RFQ note.
 */
export function parseRfqHeaderCurrency(note?: string | null): RfqHeaderCurrencyMeta {
  if (!note) {
    return { hasConversion: false, cleanNote: '' }
  }

  const match = note.match(HEADER_CURRENCY_REGEX)
  if (!match) {
    return { hasConversion: false, cleanNote: note.trim() }
  }

  const requestedCurrency = match[1]?.toUpperCase()
  const baseCurrency = match[2]?.toUpperCase() || 'USD'
  const cleanNote = note.replace(match[0], '').trim()

  return {
    hasConversion: Boolean(requestedCurrency && baseCurrency && requestedCurrency !== baseCurrency),
    requestedCurrency,
    baseCurrency,
    cleanNote,
  }
}
