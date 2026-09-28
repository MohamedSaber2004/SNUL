/* Help Center presentation helpers.
 *
 * Both functions exist because the Help Center renders API-supplied content that
 * is only partially bilingual: the backend added nullable `*Ar` columns to the
 * help model, so until those are deployed every Arabic value arrives absent.
 * Both helpers therefore treat English as the guaranteed field and never
 * substitute an empty string or an invented default for a missing one.
 */

/**
 * Pick the localised value of a help field.
 *
 * Arabic is used only when the active locale is `ar` *and* the Arabic value is
 * non-blank; otherwise the English value wins. An empty English value yields
 * `''` rather than a placeholder, so callers can test the result for emptiness
 * the same way they test the raw field.
 */
export function localizedText(
  locale: string | undefined,
  en?: string | null,
  ar?: string | null,
): string {
  if (locale === 'ar' && ar != null && ar.trim() !== '') return ar
  return en ?? ''
}

/**
 * Split an article body into paragraphs on blank lines.
 *
 * Line endings are normalised first: article bodies are authored in a CMS and
 * arrive with whatever the author's platform produced, so a Windows-authored
 * body uses `\r\n\r\n`. Splitting that on a bare `\n\n` finds nothing and
 * renders the whole article as one run-on paragraph.
 */
export function splitArticleParagraphs(body?: string | null): string[] {
  return String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}
