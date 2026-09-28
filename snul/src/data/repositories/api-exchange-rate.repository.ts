import { EXCHANGE_RATE_ROUTES } from '../../config/api.config'
import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult, ExchangeRateDto } from '../../domain/models/exchange-rate'
import type { ExchangeRateRepository } from '../../domain/ports/exchange-rate-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'
import { ApiError } from '../../infrastructure/http/api-error'

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('data' in obj && obj.data) return obj.data as T
    if ('Data' in obj && obj.Data) return obj.Data as T
    // Result wrapper with .Data
    if ('isSuccess' in obj && 'data' in obj) return obj.data as T
  }
  return raw as T
}

function normalizeList(raw: unknown): ExchangeRateDto[] {
  const data = unwrap<ExchangeRateDto[] | { data: ExchangeRateDto[] }>(raw)
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
    const inner = (data as Record<string, unknown>).data
    if (Array.isArray(inner)) return inner as ExchangeRateDto[]
  }
  // Handle Result wrapper with array inside
  if (Array.isArray((raw as Record<string, unknown>)?.data)) return (raw as Record<string, unknown>).data as ExchangeRateDto[]
  return []
}

export class ApiExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly http: HttpClient) {}

  /** Live daily rates from backend (FastForex fetch-one). No cache — every call hits the API. */
  async getLatest(base = 'USD'): Promise<ExchangeRateDto[]> {
    const upper = base.toUpperCase()
    const gatewayPath =
      upper === 'USD' ? EXCHANGE_RATE_ROUTES.latest : EXCHANGE_RATE_ROUTES.latestByBase(upper)
    try {
      const raw = await this.http.get<unknown>(gatewayPath, { showFeedback: false })
      return normalizeList(raw)
    } catch {
      return []
    }
  }

  async getPair(from: string, to: string): Promise<ExchangeRateDto | null> {
    const f = from.toUpperCase()
    const tt = to.toUpperCase()
    if (f === tt) {
      return {
        id: `pair-${f}-${tt}`,
        baseCurrency: f,
        targetCurrency: tt,
        rate: 1,
        rateDate: new Date().toISOString().slice(0, 10),
        source: 'identity',
        fetchedAt: new Date().toISOString(),
      }
    }
    try {
      const raw = await this.http.get<unknown>(EXCHANGE_RATE_ROUTES.pair(f, tt), { showFeedback: false })
      return unwrap<ExchangeRateDto>(raw)
    } catch { /* derive from live latest table below */ }
    try {
      const latest = await this.getLatest(f)
      const hit = latest.find((r) => r.targetCurrency.toUpperCase() === tt)
      if (hit) return hit
      if (f !== 'USD') {
        const usd = await this.getLatest('USD')
        const fromRate = usd.find((r) => r.targetCurrency.toUpperCase() === f)?.rate
        const toRate = usd.find((r) => r.targetCurrency.toUpperCase() === tt)?.rate
        if (fromRate && toRate && fromRate > 0) {
          return {
            id: `cross-${f}-${tt}`,
            baseCurrency: f,
            targetCurrency: tt,
            rate: toRate / fromRate,
            rateDate: new Date().toISOString().slice(0, 10),
            source: 'cross-usd',
            fetchedAt: new Date().toISOString(),
          }
        }
      }
    } catch { /* null below */ }
    return null
  }

  /** Live convert via backend (FastForex fetch-one). No cache — every call hits the API. */
  async convert(amount: number, from: string, to: string): Promise<ConversionResultDto> {
    const f = from.toUpperCase()
    const tt = to.toUpperCase()
    const qs = new URLSearchParams({ from: f, to: tt, amount: String(amount) }).toString()
    try {
      const raw = await this.http.get<unknown>(`${EXCHANGE_RATE_ROUTES.convert}?${qs}`, { showFeedback: false })
      return unwrap<ConversionResultDto>(raw)
    } catch {
      const pair = await this.getPair(f, tt)
      if (pair) {
        const convertedAmount = amount * pair.rate
        return {
          amount,
          fromCurrency: f,
          toCurrency: tt,
          rate: pair.rate,
          convertedAmount,
          rateDate: pair.rateDate,
          source: pair.source,
        }
      }
      throw new ApiError(0, 'Unable to reach the server')
    }
  }

  async convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult> {
    const raw = await this.http.post<unknown>(EXCHANGE_RATE_ROUTES.cartTotal, payload, { showFeedback: false })
    return unwrap<ConvertCartTotalResult>(raw)
  }
}
