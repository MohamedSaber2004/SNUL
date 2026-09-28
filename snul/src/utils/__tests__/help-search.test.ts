import { describe, it, expect } from 'vitest'
import {
  normalizeSearchText,
  tokenizeSearchQuery,
  scoreHelpFields,
  rankHelpArticles,
  rankHelpFaqs,
  highlightSearchMatches,
  buildSearchSnippet,
  escapeHtml,
} from '../help-search'
import type { HelpArticleDto, FaqItemDto } from '../../domain/models/content'

const article = (overrides: Partial<HelpArticleDto>): HelpArticleDto => ({
  id: 'a1',
  categoryId: 'c1',
  title: 'Sterile Autoclave Protocol',
  body: 'Validate every load at 134 degrees before release to the OR.',
  slug: 'sterile-autoclave-protocol',
  isActive: true,
  ...overrides,
})

describe('normalizeSearchText', () => {
  it('lowercases and strips latin diacritics', () => {
    expect(normalizeSearchText('Café STERILE')).toBe('cafe sterile')
  })
  it('turns punctuation into spaces (kills & / -)', () => {
    expect(normalizeSearchText('Order Status & Tracking!')).toBe('order status tracking')
  })
  it('normalizes arabic alef forms, tatweel and tashkeel', () => {
    expect(normalizeSearchText('أحـمَد')).toBe('احمد')
    expect(normalizeSearchText('إلى')).toBe('الي')
  })
  it('handles nullish input', () => {
    expect(normalizeSearchText(null)).toBe('')
    expect(normalizeSearchText(undefined)).toBe('')
  })
})

describe('tokenizeSearchQuery', () => {
  it('drops punctuation-only tokens so "&" cannot zero out results', () => {
    expect(tokenizeSearchQuery('Order Status & Tracking')).toEqual(['order', 'status', 'tracking'])
  })
  it('returns empty array for blank queries', () => {
    expect(tokenizeSearchQuery('   ')).toEqual([])
  })
})

describe('scoreHelpFields', () => {
  const fields = { id: 'a1', title: 'Sterile Autoclave Protocol', body: 'Validate every load at 134 degrees.', categoryName: 'Sterilization' }
  it('returns 0 when nothing matches', () => {
    expect(scoreHelpFields(fields, ['xylophone'])).toBe(0)
  })
  it('ranks title matches above body-only matches', () => {
    const titleHit = scoreHelpFields(fields, ['autoclave'])
    const bodyHit = scoreHelpFields(fields, ['validate'])
    expect(titleHit).toBeGreaterThan(bodyHit)
  })
  it('rewards matching every term', () => {
    const all = scoreHelpFields(fields, ['autoclave', 'sterile'])
    const one = scoreHelpFields(fields, ['autoclave'])
    expect(all).toBeGreaterThan(one)
  })
  it('matches arabic queries against un-normalized text', () => {
    const ar = { id: 'a2', title: 'دليل التعقيم', body: 'عقم الأدوات قبل الاستخدام', categoryName: '' }
    expect(scoreHelpFields(ar, ['التعقيم'])).toBeGreaterThan(0)
    expect(scoreHelpFields(ar, tokenizeSearchQuery('الأدوات'))).toBeGreaterThan(0)
  })
})

describe('rankHelpArticles', () => {
  const list = [
    article({ id: 'body-only', title: 'Unrelated Title', body: 'mentions autoclave once' }),
    article({ id: 'title-hit', title: 'Autoclave Guide', body: 'other words here' }),
    article({ id: 'inactive', title: 'Autoclave Hidden', body: 'autoclave', isActive: false }),
  ]
  it('orders title matches before body matches and drops inactive', () => {
    const ranked = rankHelpArticles(list, 'autoclave')
    expect(ranked.map((r) => r.article.id)).toEqual(['title-hit', 'body-only'])
  })
  it('respects the active category filter', () => {
    const ranked = rankHelpArticles(list, 'autoclave', { activeCategory: 'other' })
    expect(ranked).toEqual([])
  })
  it('keeps original order when the query is empty', () => {
    const ranked = rankHelpArticles(list, '   ')
    expect(ranked.map((r) => r.article.id)).toEqual(['body-only', 'title-hit'])
  })
})

describe('rankHelpFaqs', () => {
  const faqs: FaqItemDto[] = [
    { id: 'f1', question: 'How do I track freight?', answer: 'Use the tracking page.', isActive: true },
    { id: 'f2', question: 'What is the warranty?', answer: 'Twelve months.', isActive: true },
  ]
  it('finds matches in questions and answers', () => {
    expect(rankHelpFaqs(faqs, 'freight').map((r) => r.faq.id)).toEqual(['f1'])
    expect(rankHelpFaqs(faqs, 'twelve').map((r) => r.faq.id)).toEqual(['f2'])
  })
})

describe('highlightSearchMatches', () => {
  it('wraps matches in mark tags', () => {
    expect(highlightSearchMatches('Sterile Autoclave Protocol', ['autoclave'])).toBe(
      'Sterile <mark class="search-mark">Autoclave</mark> Protocol',
    )
  })
  it('escapes html before highlighting (xss safe)', () => {
    const out = highlightSearchMatches('<script>alert(1)</script> sterile', ['sterile'])
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>')
    expect(escapeHtml('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;')
  })
  it('highlights arabic letter variants', () => {
    expect(highlightSearchMatches('دليل أحمد', ['احمد'])).toContain('<mark class="search-mark">أحمد</mark>')
  })
})

describe('buildSearchSnippet', () => {
  const body = 'Intro words open this long technical bulletin about sterilization practice. The autoclave must reach 134 degrees for sterilization to pass validation in every chamber load. Trailing words follow with extra operational detail to push well past the limit.'
  it('centers the excerpt on the first match', () => {
    const snippet = buildSearchSnippet(body, ['autoclave'])
    expect(snippet).toContain('autoclave')
    expect(snippet.length).toBeLessThan(body.length)
  })
  it('falls back to the head of the body without matches', () => {
    const snippet = buildSearchSnippet(body, ['xylophone'])
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet.length).toBeLessThanOrEqual(180)
  })
  it('returns short bodies untouched', () => {
    expect(buildSearchSnippet('Short body.', ['xylophone'])).toBe('Short body.')
  })
})
