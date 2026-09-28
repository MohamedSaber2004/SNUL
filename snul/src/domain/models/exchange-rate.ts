export interface ExchangeRateDto {
  id: string
  baseCurrency: string
  targetCurrency: string
  rate: number
  rateDate: string
  source: string
  fetchedAt: string
}

export interface ConversionResultDto {
  amount: number
  fromCurrency: string
  toCurrency: string
  rate: number
  convertedAmount: number
  rateDate: string
  source: string
}

export interface CartTotalLineRequest {
  key: string
  unitAmount: number
  quantity: number
  fromCurrency: string
}

export interface ConvertCartTotalRequest {
  toCurrency: string
  lines: CartTotalLineRequest[]
}

export interface CartTotalLineResult {
  key: string
  fromCurrency: string
  unitAmount: number
  quantity: number
  rate: number
  convertedUnitAmount: number
  lineTotal: number
}

export interface ConvertCartTotalResult {
  toCurrency: string
  lines: CartTotalLineResult[]
  subtotal: number
  /** Ceiling of subtotal in ToCurrency decimals — charged total. */
  total: number
  rateDate: string
  source: string
}

export interface CurrencyRateMap {
  [code: string]: number
}

export interface LatestRatesResponse {
  isSuccess: boolean
  data: ExchangeRateDto[]
  count: number
  baseCurrency?: string
}

