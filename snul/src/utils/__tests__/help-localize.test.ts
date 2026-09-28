import { describe, it, expect } from 'vitest'
import { localizedText, splitArticleParagraphs } from '../help-localize'

const EN = 'Order Status & Tracking'
const AR = 'حالة الطلب والتتبع'

describe('localizedText', () => {
  it('returns the English value in the English locale', () => {
    expect(localizedText('en', EN, AR)).toBe(EN)
  })

  it('ignores the Arabic value in the English locale', () => {
    expect(localizedText('en', EN, 'تسمية أخرى')).toBe(EN)
  })

  it('returns the Arabic value in the Arabic locale when it is present', () => {
    expect(localizedText('ar', EN, AR)).toBe(AR)
  })

  it('falls back to English in the Arabic locale when the Arabic value is missing', () => {
    expect(localizedText('ar', EN, undefined)).toBe(EN)
    expect(localizedText('ar', EN, null)).toBe(EN)
  })

  it('falls back to English in the Arabic locale when the Arabic value is empty', () => {
    expect(localizedText('ar', EN, '')).toBe(EN)
    expect(localizedText('ar', EN, '   ')).toBe(EN)
    expect(localizedText('ar', EN, '\n\t ')).toBe(EN)
  })

  it('returns an empty string rather than a hardcoded default when English is empty', () => {
    expect(localizedText('en', '', AR)).toBe('')
    expect(localizedText('ar', '', undefined)).toBe('')
  })

  it('never returns undefined or null', () => {
    expect(localizedText('en', undefined, undefined)).toBe('')
    expect(localizedText('ar', null, null)).toBe('')
    expect(localizedText(undefined, undefined, undefined)).toBe('')
  })

  it('uses Arabic when it is the only value present, in the Arabic locale', () => {
    expect(localizedText('ar', '', AR)).toBe(AR)
  })

  it('preserves surrounding whitespace in the value it returns', () => {
    expect(localizedText('en', '  Padded  ', AR)).toBe('  Padded  ')
    expect(localizedText('ar', EN, '  Arabic  ')).toBe('  Arabic  ')
  })

  it('does not mutate its arguments', () => {
    const en = `${EN} original`
    const ar = `${AR} original`
    const snapshot = { en, ar }

    localizedText('ar', en, ar)
    localizedText('en', en, ar)
    localizedText('ar', en, '   ')

    expect({ en, ar }).toEqual(snapshot)
  })
})

describe('splitArticleParagraphs', () => {
  it('splits LF-only bodies on blank lines', () => {
    expect(splitArticleParagraphs('First para.\n\nSecond para.')).toEqual([
      'First para.',
      'Second para.',
    ])
  })

  it('splits CRLF bodies stored with Windows line endings', () => {
    // Regression: without \r normalisation "\r\n\r\n" never matches "\n\n", so a
    // Windows-authored article rendered as one run-on paragraph.
    expect(splitArticleParagraphs('First para.\r\n\r\nSecond para.')).toEqual([
      'First para.',
      'Second para.',
    ])
  })

  it('splits bodies that mix LF, CRLF and CR line endings', () => {
    const body = 'One.\r\n\r\nTwo.\n\nThree.\r\rFour.'
    expect(splitArticleParagraphs(body)).toEqual(['One.', 'Two.', 'Three.', 'Four.'])
  })

  it('treats a run of more than two newlines as one paragraph break', () => {
    expect(splitArticleParagraphs('One.\n\n\n\nTwo.')).toEqual(['One.', 'Two.'])
  })

  it('keeps single newlines inside a paragraph', () => {
    expect(splitArticleParagraphs('Line one.\nLine two.')).toEqual(['Line one.\nLine two.'])
  })

  it('drops paragraphs that are empty or whitespace only', () => {
    expect(splitArticleParagraphs('\r\n\r\n  \r\n\r\nReal text.\r\n\r\n   ')).toEqual([
      'Real text.',
    ])
  })

  it('returns no paragraphs for an empty or whitespace-only body', () => {
    expect(splitArticleParagraphs('')).toEqual([])
    expect(splitArticleParagraphs('   \r\n  ')).toEqual([])
    expect(splitArticleParagraphs(undefined)).toEqual([])
    expect(splitArticleParagraphs(null)).toEqual([])
  })

  it('trims carriage returns left at the edges of a paragraph', () => {
    expect(splitArticleParagraphs('Only one.')).toEqual(['Only one.'])
  })

  it('does not mutate its argument', () => {
    const body = 'First.\r\n\r\nSecond.'
    const snapshot = `${body}`
    splitArticleParagraphs(body)
    expect(body).toBe(snapshot)
  })
})
