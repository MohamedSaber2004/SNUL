import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLandingPageBySlug } from '../landing-page'
import type { LandingPageDto } from '../../domain/models/content'

/**
 * Regression guard for the guest-mode console 404 on the homepage:
 *
 *   GET /api/v1/landing-pages/slug/home-hero  ->  404 (Not Found)
 *
 * `home-hero` is an optional admin-created record, and nothing seeds it, so a
 * database without one has nothing to return. The view used to request that slug
 * unconditionally on every mount, producing a 404 on every cold guest load even
 * though the page rendered correctly from its i18n fallback.
 *
 * The fix resolves both the hero and the about copy out of the landing-page
 * collection the page already fetches, so an absent record means "no request and
 * no 404" instead of "request that fails".
 */
describe('findLandingPageBySlug', () => {
  const page = (slug: string, over: Partial<LandingPageDto> = {}): LandingPageDto => ({
    id: `id-${slug}`,
    type: 'Brand',
    slug,
    heroTitle: `${slug} title`,
    heroBody: `${slug} body`,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  })

  it('finds the record when it exists', () => {
    const pages = [page('about-us'), page('home-hero')]
    expect(findLandingPageBySlug(pages, 'home-hero')?.slug).toBe('home-hero')
  })

  it('returns null when the record does not exist (the 404 case)', () => {
    expect(findLandingPageBySlug([page('about-us')], 'home-hero')).toBeNull()
  })

  it('returns null for an empty, null or undefined collection', () => {
    expect(findLandingPageBySlug([], 'home-hero')).toBeNull()
    expect(findLandingPageBySlug(null, 'home-hero')).toBeNull()
    expect(findLandingPageBySlug(undefined, 'home-hero')).toBeNull()
  })

  it('matches case-insensitively, like the backend by-slug route', () => {
    const pages = [page('Home-Hero')]
    expect(findLandingPageBySlug(pages, 'home-hero')?.slug).toBe('Home-Hero')
    expect(findLandingPageBySlug(pages, 'HOME-HERO')?.slug).toBe('Home-Hero')
  })

  it('tolerates surrounding whitespace on the slug', () => {
    expect(findLandingPageBySlug([page('home-hero')], '  home-hero  ')?.slug).toBe('home-hero')
  })

  it('ignores an inactive record so the caller keeps its i18n copy', () => {
    const pages = [page('home-hero', { isActive: false })]
    expect(findLandingPageBySlug(pages, 'home-hero')).toBeNull()
  })

  it('accepts a record with no isActive flag (treated as active)', () => {
    const pages = [{ ...page('home-hero'), isActive: undefined }]
    expect(findLandingPageBySlug(pages, 'home-hero')?.slug).toBe('home-hero')
  })

  it('returns null for a blank slug instead of matching the first record', () => {
    expect(findLandingPageBySlug([page('home-hero')], '   ')).toBeNull()
  })

  it('skips malformed entries without throwing', () => {
    const pages = [null as unknown as LandingPageDto, page('home-hero')]
    expect(findLandingPageBySlug(pages, 'home-hero')?.slug).toBe('home-hero')
  })
})

describe('HomeView resolves the hero without a by-slug request', () => {
  // Vite rewrites `new URL('./x', import.meta.url)` to a dev-server URL, which
  // fileURLToPath rejects; resolve from the decoded path instead.
  const here = dirname(fileURLToPath(import.meta.url))
  const source = readFileSync(resolve(here, '../../views/HomeView.vue'), 'utf8')

  it('does not request the home-hero slug over the network', () => {
    // The slug now only ever appears as a lookup key against the loaded list.
    expect(source).not.toMatch(/getLandingPageBySlug\(\s*HERO_SLUG\s*\)/)
  })

  it('does not request the about-us slug over the network either', () => {
    expect(source).not.toMatch(/getLandingPageBySlug\(\s*'about-us'\s*\)/)
  })

  it('still loads the landing-page collection both records come from', () => {
    expect(source).toMatch(/getLandingPages\(\{[^}]*pageSize:\s*\d+/)
  })

  it('keeps both sections on separate endpoints', () => {
    // Category grid -> paginated; specialty filter -> unpaginated.
    expect(source).toMatch(/getCategoriesPaginated\(/)
    expect(source).toMatch(/marketplaceRepository\.getCategories\(\)/)
  })
})
