import { describe, it, expect } from 'vitest'
import {
  formatRfqCurrencyNote,
  parseRfqCurrencyNote,
  formatRfqHeaderCurrencyNote,
  parseRfqHeaderCurrency,
} from '../rfq-currency'

describe('rfq-currency utility', () => {
  it('formats and parses item currency note correctly', () => {
    const formatted = formatRfqCurrencyNote({
      baseCurrency: 'USD',
      requestedCurrency: 'EGP',
      basePrice: 100,
      requestedPrice: 5150,
      rate: 51.5,
      userNote: 'Please deliver to warehouse',
    })

    expect(formatted).toContain('[CURRENCY_REQUEST: BASE=100 USD | REQUESTED=5150 EGP | RATE=51.5]')
    expect(formatted).toContain('Please deliver to warehouse')

    const parsed = parseRfqCurrencyNote(formatted)
    expect(parsed.hasConversion).toBe(true)
    expect(parsed.baseCurrency).toBe('USD')
    expect(parsed.requestedCurrency).toBe('EGP')
    expect(parsed.basePrice).toBe(100)
    expect(parsed.requestedPrice).toBe(5150)
    expect(parsed.rate).toBe(51.5)
    expect(parsed.cleanNote).toBe('Please deliver to warehouse')
  })

  it('handles item notes without conversion tags', () => {
    const parsed = parseRfqCurrencyNote('Standard item note')
    expect(parsed.hasConversion).toBe(false)
    expect(parsed.cleanNote).toBe('Standard item note')
    expect(parsed.baseCurrency).toBeUndefined()
  })

  it('formats and parses header currency note correctly', () => {
    const formatted = formatRfqHeaderCurrencyNote('SAR', 'USD', 'Urgent order')
    expect(formatted).toContain('[REQUESTED_CURRENCY: SAR (Base: USD)]')
    expect(formatted).toContain('Urgent order')

    const parsed = parseRfqHeaderCurrency(formatted)
    expect(parsed.hasConversion).toBe(true)
    expect(parsed.requestedCurrency).toBe('SAR')
    expect(parsed.baseCurrency).toBe('USD')
    expect(parsed.cleanNote).toBe('Urgent order')
  })

  it('treats an empty note as no conversion', () => {
    expect(parseRfqCurrencyNote(undefined).hasConversion).toBe(false)
    expect(parseRfqCurrencyNote(null).cleanNote).toBe('')
    expect(parseRfqHeaderCurrency(undefined).hasConversion).toBe(false)
    expect(parseRfqHeaderCurrency(null).cleanNote).toBe('')
  })

  it('reports no conversion when base and requested currencies match', () => {
    const formatted = formatRfqCurrencyNote({
      baseCurrency: 'USD',
      requestedCurrency: 'USD',
      basePrice: 100,
      requestedPrice: 100,
    })
    expect(parseRfqCurrencyNote(formatted).hasConversion).toBe(false)
  })
})
