import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult, ExchangeRateDto } from '../models/exchange-rate'

export interface ExchangeRateRepository {
  getLatest(base?: string): Promise<ExchangeRateDto[]>
  getPair(from: string, to: string): Promise<ExchangeRateDto | null>
  convert(amount: number, from: string, to: string): Promise<ConversionResultDto>
  convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult>
}
