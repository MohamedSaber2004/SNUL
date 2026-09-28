import type { FaqItemDto, HelpArticleDto } from '../domain/models/content'

/* Shared Help Center search engine (articles + FAQs).
 *
 * Correctness notes (previous bugs fixed here):
 * - Diacritics are stripped with real unicode ranges (was a literal-char
 *   range that silently did nothing), plus Arabic tashkeel / tatweel / alef
 *   normalization so EN + AR queries match reliably.
 * - Punctuation-only tokens (e.g. the "&" in "Order Status & Tracking") are
 *   dropped during tokenization instead of forcing zero results.
 * - Matching is ranked by relevance (title > category > body, whole-word and
 *   all-terms bonuses) instead of strict AND-every-term filtering, so
 *   multi-word queries return the best matches first instead of nothing.
 */

export interface ArticleSearchFields {
  id: string
  title: string
  body: string
  categoryName: string
}

/** Normalize for case/diacritic-insensitive matching (EN + AR). */
export function normalizeSearchText(text: unknown): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a raw query into matchable tokens (drops punctuation-only tokens). */
export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean)
}

function countWholeWord(haystack: string, term: string): number {
  let n = 0
  for (const word of haystack.split(' ')) {
    if (word === term) n += 1
  }
  return n
}

/** Relevance score for one document; 0 means "no match". */
export function scoreHelpFields(fields: ArticleSearchFields, terms: string[]): number {
  if (!terms.length) return 0
  const title = normalizeSearchText(fields.title)
  const body = normalizeSearchText(fields.body)
  const category = normalizeSearchText(fields.categoryName)
  const id = normalizeSearchText(fields.id)
  let score = 0
  let matched = 0
  for (const term of terms) {
    let termScore = 0
    if (title === term) termScore += 16
    else if (countWholeWord(title, term) > 0) termScore += 12
    else if (title.includes(term)) termScore += 8
    if (countWholeWord(category, term) > 0) termScore += 7
    else if (category && category.includes(term)) termScore += 4
    if (id.includes(term)) termScore += 3
    if (countWholeWord(body, term) > 0) termScore += 3
    else if (body.includes(term)) termScore += 1.5
    if (termScore === 0) continue
    matched += 1
    score += termScore
  }
  if (matched === 0) return 0
  if (matched === terms.length) score += 10
  else score *= matched / terms.length
  return score
}

export interface RankedHelpArticle {
  article: HelpArticleDto
  score: number
  snippet: string
  titleHtml: string
  bodyHtml: string
}

export interface RankHelpOptions {
  activeCategory?: string | null
  categoryNameOf?: (categoryId?: string | null) => string
}

/** Filter (active + category) and rank articles for a query. Empty query keeps original order. */
export function rankHelpArticles(
  articles: HelpArticleDto[],
  query: string,
  options: RankHelpOptions = {},
): RankedHelpArticle[] {
  const list = Array.isArray(articles) ? articles : []
  const { activeCategory = 'all', categoryNameOf = () => '' } = options
  const terms = tokenizeSearchQuery(query)
  const out: RankedHelpArticle[] = []
  for (const article of list) {
    if (!article || article.isActive === false) continue
    if (activeCategory && activeCategory !== 'all' && article.categoryId !== activeCategory) continue
    const categoryName = categoryNameOf(article.categoryId)
    if (!terms.length) {
      out.push({ article, score: 0, snippet: '', titleHtml: '', bodyHtml: '' })
      continue
    }
    const score = scoreHelpFields(
      { id: article.id, title: article.title, body: article.body, categoryName },
      terms,
    )
    if (score <= 0) continue
    const snippet = buildSearchSnippet(article.body, terms)
    out.push({
      article,
      score,
      snippet,
      titleHtml: highlightSearchMatches(article.title, terms),
      bodyHtml: highlightSearchMatches(snippet || article.body, terms),
    })
  }
  if (terms.length) out.sort((a, b) => b.score - a.score)
  return out
}

export interface RankedHelpFaq {
  faq: FaqItemDto
  score: number
  answerHtml: string
  questionHtml: string
}

/** Rank FAQs for a query. Empty query keeps original order. */
export function rankHelpFaqs(faqs: FaqItemDto[], query: string): RankedHelpFaq[] {
  const list = Array.isArray(faqs) ? faqs : []
  const terms = tokenizeSearchQuery(query)
  const out: RankedHelpFaq[] = []
  for (const faq of list) {
    if (!faq || faq.isActive === false) continue
    if (!terms.length) {
      out.push({ faq, score: 0, questionHtml: '', answerHtml: '' })
      continue
    }
    const score = scoreHelpFields(
      { id: faq.id, title: faq.question, body: faq.answer, categoryName: '' },
      terms,
    )
    if (score <= 0) continue
    out.push({
      faq,
      score,
      questionHtml: highlightSearchMatches(faq.question, terms),
      answerHtml: highlightSearchMatches(faq.answer, terms),
    })
  }
  if (terms.length) out.sort((a, b) => b.score - a.score)
  return out
}

/* ── Highlighting (tolerant EN diacritics + AR letter variants) ── */

const LATIN_VARIANTS: Record<string, string> = {
  a: 'aàáâãäåāăą', e: 'eèéêëēĕėę', i: 'iìíîïīĭįı', o: 'oòóôõöøōŏő',
  u: 'uùúûüūŭůűų', c: 'cçćĉċč', n: 'nñńņň', s: 'sśŝşš', z: 'zźżž',
  y: 'yýÿŷ', g: 'gĝğġģ', h: 'hĥħ', j: 'jĵ', k: 'kķ', l: 'lĺļľŀł',
  r: 'rŕŗř', t: 'tţťŧ', w: 'wŵ', d: 'dďđ', p: 'pṕ', x: 'xẋ', q: 'q', b: 'b', f: 'f', m: 'm', v: 'v',
}

const ARABIC_VARIANTS: Record<string, string> = {
  'ا': 'اأإآ',
  'ه': 'هة',
  'ي': 'يى',
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Turn one normalized term into a regex source matching raw text variants. */
function tolerantPattern(term: string): string {
  let pattern = ''
  for (const ch of term) {
    const latin = LATIN_VARIANTS[ch]
    if (latin) {
      pattern += `[${escapeRegExp(latin)}]`
      continue
    }
    const arabic = ARABIC_VARIANTS[ch]
    if (arabic) {
      pattern += `[${arabic}]`
      continue
    }
    if (ch === ' ') {
      pattern += '\\s+'
      continue
    }
    pattern += escapeRegExp(ch)
  }
  return pattern
}

export function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * HTML-escape text, then wrap query matches in <mark class="search-mark">.
 * Safe for v-html: entities are protected from matching and all markup comes
 * from escaping first.
 */
export function highlightSearchMatches(text: string, terms: string[]): string {
  const escaped = escapeHtml(text)
  const unique = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length)
  const group = unique.map(tolerantPattern).filter(Boolean).join('|')
  if (!group) return escaped
  const rx = new RegExp(`(${group})`, 'giu')
  // Never match inside an HTML entity (e.g. "&amp;").
  return escaped
    .split(/(&[a-zA-Z0-9#]+;)/g)
    .map((chunk, idx) => (idx % 2 === 1 ? chunk : chunk.replace(rx, '<mark class="search-mark">$1</mark>')))
    .join('')
}

/** Contextual excerpt around the first match (word-boundary trimmed). */
export function buildSearchSnippet(body: string, terms: string[], maxLength = 180): string {
  const text = String(body ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (!terms.length) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
  }
  const unique = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length)
  const group = unique.map(tolerantPattern).filter(Boolean).join('|')
  if (!group) return text.slice(0, maxLength)
  const match = new RegExp(group, 'iu').exec(text)
  if (!match || match.index === undefined) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
  }
  const start = Math.max(0, match.index - 70)
  const end = Math.min(text.length, match.index + match[0].length + 90)
  let snippet = text.slice(start, end)
  if (start > 0) {
    const cut = snippet.indexOf(' ')
    snippet = snippet.slice(cut > 0 ? cut + 1 : 0)
    snippet = `…${snippet}`
  }
  if (end < text.length) {
    const cut = snippet.lastIndexOf(' ')
    snippet = cut > 0 ? snippet.slice(0, cut) : snippet
    snippet = `${snippet}…`
  }
  return snippet
}
