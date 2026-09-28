import { describe, it, expect } from 'vitest'
import { ContentService } from '../content.service'
import type { ContentRepository } from '../../domain/ports/content-repository'
import type { HelpSiteStatDto } from '../../domain/models/content'

function stat(over: Partial<HelpSiteStatDto> = {}): HelpSiteStatDto {
  return {
    id: 'id-1',
    statKey: 'lotTraceable',
    value: '100%',
    label: 'LOT TRACEABLE',
    sortOrder: 0,
    isVisible: true,
    ...over,
  }
}

/** A service whose only wired method is `getHelpSiteStats`. */
function serviceWith(getHelpSiteStats: () => Promise<HelpSiteStatDto[]>): ContentService {
  return new ContentService({ getHelpSiteStats } as unknown as ContentRepository)
}

describe('loadHelpSiteStats', () => {
  it('keeps the previous hero when the fetch fails', async () => {
    const published = [stat({ id: 'a' })]
    let fail = false
    const service = serviceWith(async () => {
      if (fail) throw new Error('network flaked')
      return published
    })

    await service.loadHelpSiteStats()
    expect(service.helpSiteStats.value).toEqual(published)

    fail = true
    await service.loadHelpSiteStats()
    expect(service.helpSiteStats.value).toEqual(published)
  })

  it('commits an empty list when the backend reports no claims', async () => {
    let rows: HelpSiteStatDto[] = [stat({ id: 'a' })]
    const service = serviceWith(async () => rows)

    await service.loadHelpSiteStats()
    expect(service.helpSiteStats.value).toEqual([stat({ id: 'a' })])

    // An admin withdrawing every stat must make the hero disappear.
    rows = []
    await service.loadHelpSiteStats()
    expect(service.helpSiteStats.value).toEqual([])
  })

  it('stays empty rather than throwing when the first load fails', async () => {
    const service = serviceWith(async () => {
      throw new Error('gateway cold')
    })
    await expect(service.loadHelpSiteStats()).resolves.toEqual([])
    expect(service.helpSiteStats.value).toEqual([])
  })
})

describe('siteLogo', () => {
  it('loads site logo and updates reactive state', async () => {
    const fakeLogo = { id: 'logo-1', logoUrl: '/files/dynamic-logo.png', altText: 'SNUL Global' }
    const repo = {
      getSiteLogo: async () => fakeLogo,
      upsertSiteLogo: async (payload: any) => ({ ...fakeLogo, ...payload }),
    } as unknown as ContentRepository
    const service = new ContentService(repo)

    const loaded = await service.loadSiteLogo()
    expect(loaded).toEqual(fakeLogo)
    expect(service.siteLogo.value).toEqual(fakeLogo)

    const updated = await service.upsertSiteLogo({ logoUrl: '/files/new-logo.png', altText: 'Updated SNUL' })
    expect(updated.logoUrl).toBe('/files/new-logo.png')
    expect(service.siteLogo.value.logoUrl).toBe('/files/new-logo.png')
  })

  it('keeps default fallback when logoUrl is empty', async () => {
    const emptyLogo = { id: '', logoUrl: '', altText: 'SNUL' }
    const repo = {
      getSiteLogo: async () => emptyLogo,
    } as unknown as ContentRepository
    const service = new ContentService(repo)

    await service.loadSiteLogo()
    expect(service.siteLogo.value.logoUrl).toBe('')
    expect(service.siteLogo.value.altText).toBe('SNUL')
  })
})
