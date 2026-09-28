import { describe, it, expect, vi } from 'vitest'
import { ExchangeRateService } from '../exchange-rate.service'
import type { ExchangeRateRepository } from '../../domain/ports/exchange-rate-repository'

describe('ExchangeRateService (pure backend data)', () => {
  it('uses live rates from repository when available', async () => {
    const mockRepo: ExchangeRateRepository = {
      getLatest: vi.fn().mockResolvedValue([
        {
          id: 'rate-1',
          baseCurrency: 'USD',
          targetCurrency: 'EGP',
          rate: 51.5,
          rateDate: '2026-09-26',
          source: 'YahooFinance',
          fetchedAt: '2026-09-26T12:00:00Z',
        },
      ]),
      getPair: vi.fn(),
      convert: vi.fn().mockResolvedValue({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EGP',
        rate: 51.5,
        convertedAmount: 5150,
        rateDate: '2026-09-26',
        source: 'YahooFinance',
      }),
      convertCartTotal: vi.fn(),
    }

    const svc = new ExchangeRateService(mockRepo)
    const map = await svc.loadLatest('USD')
    expect(map.get('EGP')).toBe(51.5)
    expect(svc.lastUpdatedSource.value).toBe('live')

    const res = await svc.convert(100, 'USD', 'EGP')
    expect(res.convertedAmount).toBe(5150)
    // The source must stay the real backend value. A locally derived rate
    // reported as 'live' would be indistinguishable once written into an RFQ.
    expect(res.source).toBe('YahooFinance')
  })

  it('propagates error when repository fails without injecting fallback data', async () => {
    const failingRepo: ExchangeRateRepository = {
      getLatest: vi.fn().mockRejectedValue(new Error('Network error or 400 Bad Request')),
      getPair: vi.fn().mockRejectedValue(new Error('Network error')),
      convert: vi.fn().mockRejectedValue(new Error('Network error')),
      convertCartTotal: vi.fn(),
    }

    const svc = new ExchangeRateService(failingRepo)
    await expect(svc.loadLatest('USD')).rejects.toThrow('Network error or 400 Bad Request')
    expect(svc.latestRates.value.size).toBe(0)
    expect(svc.lastUpdatedSource.value).toBeNull()

    await expect(svc.convert(310.8, 'USD', 'EGP')).rejects.toThrow('Network error')
  })

  it('reuses the loaded rate table instead of refetching per conversion', async () => {
    const getLatest = vi.fn().mockResolvedValue([
      {
        id: 'rate-1',
        baseCurrency: 'USD',
        targetCurrency: 'EGP',
        rate: 50,
        rateDate: '2026-09-26',
        source: 'YahooFinance',
        fetchedAt: '2026-09-26T12:00:00Z',
      },
    ])
    const repo: ExchangeRateRepository = {
      getLatest,
      getPair: vi.fn(),
      convert: vi.fn(),
      convertCartTotal: vi.fn(),
    }

    const svc = new ExchangeRateService(repo)
    await svc.loadLatest('USD')
    expect(await svc.convertLocal(10, 'USD', 'EGP')).toBe(500)
    expect(await svc.convertLocal(10, 'USD', 'EGP')).toBe(500)
    await svc.convertLocal(20, 'USD', 'EGP')
    await svc.convertLocal(30, 'USD', 'EGP')

    // One fetch for the whole batch, not one per cart line.
    expect(getLatest).toHaveBeenCalledTimes(1)
  })

  it('is a no-op for same-currency conversion and does not hit the API', async () => {
    const getLatest = vi.fn()
    const convert = vi.fn()
    const repo: ExchangeRateRepository = {
      getLatest,
      getPair: vi.fn(),
      convert,
      convertCartTotal: vi.fn(),
    }

    const svc = new ExchangeRateService(repo)
    expect(await svc.convertLocal(42, 'usd', 'USD')).toBe(42)
    expect(getLatest).not.toHaveBeenCalled()
    expect(convert).not.toHaveBeenCalled()
  })
})
