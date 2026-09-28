import type { LandingPageDto } from '../domain/models/content'

/**
 * Resolve a single landing page (by slug) out of an already-loaded collection.
 *
 * Why this exists: the landing hero and the about copy are both `LandingPage`
 * records, and the pages that show them already fetch the landing-page
 * collection. Picking the record out of that list avoids issuing a separate
 * `GET /landing-pages/slug/{slug}` for a slug that may not exist — which is
 * what produced a console 404 on every cold guest homepage load, since a
 * database with no `home-hero` row has nothing to return but 404.
 *
 * The backend filters `IsActive` on the by-slug route; this mirrors that so both
 * paths agree. A missing or inactive record yields `null`, and the caller keeps
 * its own built-in (i18n) copy.
 */
export function findLandingPageBySlug(
  pages: readonly LandingPageDto[] | null | undefined,
  slug: string,
): LandingPageDto | null {
  if (!pages?.length) return null

  const target = slug.trim().toLowerCase()
  if (!target) return null

  const match = pages.find((p) => (p?.slug ?? '').trim().toLowerCase() === target)
  if (!match) return null

  return match.isActive === false ? null : match
}
