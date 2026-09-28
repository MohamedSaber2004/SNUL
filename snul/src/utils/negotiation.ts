export interface NegotiationData {
  isNegotiation: boolean
  targetTotal?: string
  discountPercent?: string
  reason?: string
  cleanNote?: string
}

export function parseNegotiationNote(note?: string | null): NegotiationData {
  if (!note) {
    return { isNegotiation: false, cleanNote: '' }
  }

  const match = note.match(/\[PRICE_NEGOTIATION:\s*TARGET_TOTAL=([^(\]]+)(?:\(Discount:\s*(\d+)%\))?\](?:\[REASON:\s*([^\]]*)\])?/)
  if (!match) {
    return { isNegotiation: false, cleanNote: note }
  }

  const targetTotal = match[1]?.trim()
  const discountPercent = match[2]?.trim()
  const reason = match[3]?.trim()
  const cleanNote = note.replace(match[0], '').trim()

  return {
    isNegotiation: true,
    targetTotal,
    discountPercent,
    reason: reason === 'N/A' ? undefined : reason,
    cleanNote,
  }
}
