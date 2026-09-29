import { ref, computed, watch } from 'vue'
import type { CartItem, ProductDto } from '../domain/models/marketplace'
import type { CreateOrderItemPayload } from '../domain/models/commerce'
import type { CreateRfqItemPayload } from '../domain/models/sales'
import { services } from '../di/container'
import { buildCreateCartPayload } from '../application/commerce.service'
import { toastService } from '../infrastructure/feedback/toast.service'
import { t } from '../i18n'
import router from '../router'
import { formatRfqCurrencyNote } from '../utils/rfq-currency'

const CART_KEY = 'snul-cart'
const LEGACY_CART_KEY = 'welco-cart'
const NOTE_KEY = 'snul-quote-note'
const LEGACY_NOTE_KEY = 'welco-quote-note'
const TC_KEY = 'snul-target-currency'
const LEGACY_TC_KEY = 'welco-target-currency'
const CART_ID_KEY = 'snul-cart-id'
const LEGACY_CART_ID_KEY = 'welco-cart-id'
const SESS_ID_KEY = 'snul-session-id'
const LEGACY_SESS_ID_KEY = 'welco-session-id'

const items = ref<CartItem[]>([])
const quoteNote = ref('')
const targetCurrency = ref<string>(
  (typeof window !== 'undefined' ? (localStorage.getItem(TC_KEY) || localStorage.getItem(LEGACY_TC_KEY)) : null) || 'USD',
)
// Product ids the backend could NOT price (missing DB rate). Totals for the
// cart are never computed here — only the backend cart-total quote is shown.
const unconvertedIds = ref<string[]>([])

/** Ceiling for made-to-order lines. A product with `stock === 0` has no stock
 *  cap at all (it is built to order), so `stock` must never be used as a
 *  maximum there — clamping against 0 is what used to put quantity 0 in the
 *  cart and freeze its stepper. */
const MADE_TO_ORDER_MAX_QTY = 9999

/** Largest quantity the cart will accept for a product. Exported so the cart
 *  line stepper gets the same ceiling `add`/`setQty` enforce. */
function maxQtyFor(product: ProductDto): number {
  return product.stock > 0 ? product.stock : MADE_TO_ORDER_MAX_QTY
}

/** Clamp a requested quantity into [minOrderQty, maxQtyFor]. */
function clampQty(product: ProductDto, qty: number): number {
  return Math.min(maxQtyFor(product), Math.max(product.minOrderQty, qty))
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY) || localStorage.getItem(LEGACY_CART_KEY)
    if (raw) items.value = JSON.parse(raw) as CartItem[]
    const note = localStorage.getItem(NOTE_KEY) || localStorage.getItem(LEGACY_NOTE_KEY)
    if (note) quoteNote.value = note
    const tc = localStorage.getItem(TC_KEY) || localStorage.getItem(LEGACY_TC_KEY)
    if (tc) targetCurrency.value = tc
  } catch {  }
}
function persist() {
  const json = JSON.stringify(items.value)
  localStorage.setItem(CART_KEY, json)
  localStorage.setItem(LEGACY_CART_KEY, json)
}
function persistTarget() {
  localStorage.setItem(TC_KEY, targetCurrency.value)
  localStorage.setItem(LEGACY_TC_KEY, targetCurrency.value)
}

// Server-synced cart (guest sessionId + auth merge). localStorage `snul-cart`
// stays the offline source of truth; server calls are best-effort and never throw.
const serverCartId = ref<string | null>(
  typeof window !== 'undefined' ? (localStorage.getItem(CART_ID_KEY) || localStorage.getItem(LEGACY_CART_ID_KEY)) : null,
)
let serverSyncScheduled = false

function setCartId(id: string) {
  try {
    localStorage.setItem(CART_ID_KEY, id)
    localStorage.setItem(LEGACY_CART_ID_KEY, id)
  } catch {}
}

function removeCartId() {
  try {
    localStorage.removeItem(CART_ID_KEY)
    localStorage.removeItem(LEGACY_CART_ID_KEY)
  } catch {}
}

function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SESS_ID_KEY) || localStorage.getItem(LEGACY_SESS_ID_KEY)
    if (!sid) {
      sid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(SESS_ID_KEY, sid)
      localStorage.setItem(LEGACY_SESS_ID_KEY, sid)
    }
    return sid
  } catch {
    return `sess-${Date.now()}`
  }
}

function resolveCurrencyId(): string | undefined {
  try {
    const code = targetCurrency.value.toUpperCase()
    return services.marketplaceService.currencies.value.find((c) => (c.code || '').toUpperCase() === code)?.id
  } catch {
    return undefined
  }
}

async function syncToServer(): Promise<void> {
  // Only meaningful in the browser — this guard must stay inverted from the
  // obvious reading or the whole function no-ops on the client and the
  // server cart (create / merge / restore) never happens.
  if (typeof window === 'undefined') return
  const auth = services.authService
  // Never sync customer carts for admins, sales staff, or providers
  if (auth.isAdmin.value || auth.isSales.value || auth.isProvider.value) {
    serverCartId.value = null
    removeCartId()
    return
  }
  const preUserId = auth.user.value?.id ?? null
  if (!preUserId) return
  try {
    const sid = getSessionId()
    if (!items.value.length) {
      try {
        const existing = await services.commerceRepository.getBySession(sid)
        const id = (existing as unknown as { id?: string } | null)?.id
        if (id) {
          serverCartId.value = id
          setCartId(id)
        }
      } catch (err: unknown) {
        const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode
        if (status === 404 || String((err as Error)?.message).includes('404')) {
          serverCartId.value = null
          removeCartId()
        }
      }
      return
    }
    const userId = auth.user.value?.id ?? null
    const payload = buildCreateCartPayload(userId, sid, resolveCurrencyId())
    let cartId = serverCartId.value
    if (!cartId) {
      if (!userId) {
        try {
          const existing = await services.commerceRepository.getBySession(sid)
          const id = (existing as unknown as { id?: string } | null)?.id
          if (id) cartId = id
        } catch (err: unknown) {
          const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode
          if (status === 404 || String((err as Error)?.message).includes('404')) {
            serverCartId.value = null
            removeCartId()
          }
        }
      }
      if (!cartId) {
        const created = await services.commerceRepository.createCart(payload)
        cartId = (created as unknown as { id?: string } | null)?.id ?? null
      }
      if (cartId) {
        serverCartId.value = cartId
        setCartId(cartId)
      }
    }
    if (!cartId) return
    for (const line of items.value) {
      try {
        await services.commerceRepository.addItem(cartId, {
          productId: line.product.id,
          quantity: line.quantity,
          unitPriceSnapshot: line.product.price,
        })
      } catch (err: unknown) {
        const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode
        if (status === 404 || String((err as Error)?.message).includes('404')) {
          // Stale cart ID in localStorage no longer exists on backend; invalidate it
          serverCartId.value = null
          removeCartId()
          break
        }
      }
    }
  } catch (err) {
    try { toastService.error(err instanceof Error ? err.message : t('common.error')) } catch { /* never block */ }
  }
}

async function clearServerCart(): Promise<void> {
  const id = serverCartId.value ?? (typeof window !== 'undefined' ? (localStorage.getItem(CART_ID_KEY) || localStorage.getItem(LEGACY_CART_ID_KEY)) : null)
  if (!id) return
  try {
    await services.commerceRepository.clearCart(id)
  } catch (err: unknown) {
    const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode
    if (status !== 404 && !String((err as Error)?.message).includes('404')) {
      try { toastService.error(err instanceof Error ? err.message : t('common.error')) } catch { /* never block */ }
    }
  } finally {
    serverCartId.value = null
    removeCartId()
  }
}

export interface ServerCartLineTotal {
  productId: string
  /** The unit price that is actually billed: the converted amount rounded UP to
   *  a whole currency unit. This single figure backs the per-unit display, the
   *  line total, the order payload and the RFQ payload — nothing rounds again
   *  downstream, so a printed "unit × qty" can never disagree with its total. */
  convertedUnit: number
  /** Alias of `convertedUnit`, kept for existing consumers. */
  ceiledUnit: number
  /** Un-rounded, un-converted catalogue price in the product's own currency. */
  nativeUnit: number
  nativeCurrency: string
  /** Quantity captured when this line was priced. */
  quantity: number
  lineTotal: number
  rate: number
}

export interface ServerCartTotal {
  total: number
  subtotal: number
  currency: string
  lines: Map<string, ServerCartLineTotal>
  source: string
}

/** Backend-calculated cart total (DB rates + ceiling). Null until quoted. */
const serverTotal = ref<ServerCartTotal | null>(null)
const serverTotalLoading = ref(false)
let serverTotalSeq = 0
let serverTotalTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Price each cart item in the target currency using the public /convert
 * endpoint (from / to / amount). Totals are computed here from the returned
 * converted amounts; no backend cart-total quote is used.
 */
/**
 * Exchange rates should only be loaded/converted in cart context, never on the
 * home page or any other page.
 */
function isCartOrCheckoutActive(): boolean {
  if (typeof window === 'undefined') return false
  const routePath = (router.currentRoute?.value?.path || '').toLowerCase()
  const locPath = (window.location?.pathname || '').toLowerCase()
  return (
    routePath.startsWith('/cart') ||
    routePath.startsWith('/checkout') ||
    locPath.includes('/cart') ||
    locPath.includes('/checkout')
  )
}

async function refreshServerTotal(force = false): Promise<void> {
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return
  if (!force && !isCartOrCheckoutActive()) return
  if (!items.value.length) {
    serverTotal.value = null
    serverTotalLoading.value = false
    unconvertedIds.value = []
    return
  }
  const tCur = targetCurrency.value.toUpperCase()
  const seq = ++serverTotalSeq
  serverTotalLoading.value = true
  try {
    const results = await Promise.all(
      items.value.map(async (item) => {
        const fromCurrency = (item.product.currencyCode || item.product.currency || 'USD').toUpperCase()
        const nativePrice = Number(item.product.price)
        const converted = await services.exchangeRateService.convert(nativePrice, fromCurrency, tCur)
        // Round exactly once, here. Everything downstream (displayed unit price,
        // line total, order payload, RFQ payload) reads this same number.
        const unit = Math.ceil(converted.convertedAmount)
        return {
          productId: item.product.id,
          convertedUnit: unit,
          ceiledUnit: unit,
          nativeUnit: nativePrice,
          nativeCurrency: fromCurrency,
          quantity: item.quantity,
          lineTotal: unit * item.quantity,
          rate: converted.rate,
        }
      }),
    )
    if (seq !== serverTotalSeq) return
    const lines = new Map<string, ServerCartLineTotal>()
    for (const r of results) {
      lines.set(r.productId, r)
    }
    const subtotal = results.reduce((sum, r) => sum + r.lineTotal, 0)
    serverTotal.value = {
      total: subtotal,
      subtotal: subtotal,
      currency: tCur,
      lines,
      source: 'frontend',
    }
    unconvertedIds.value = items.value.filter((i) => !lines.has(i.product.id)).map((i) => i.product.id)
  } catch {
    if (seq !== serverTotalSeq) return
    serverTotal.value = null
    unconvertedIds.value = items.value.map((i) => i.product.id)
  } finally {
    if (seq === serverTotalSeq) serverTotalLoading.value = false
  }
}

function scheduleServerTotal(): void {
  if (typeof window === 'undefined' || import.meta.env?.MODE === 'test') return
  if (serverTotalTimer) clearTimeout(serverTotalTimer)
  serverTotalTimer = setTimeout(() => {
    serverTotalTimer = null
    void refreshServerTotal()
  }, 350)
}

if (typeof window !== 'undefined') loadFromStorage()

watch(targetCurrency, persistTarget)

watch(
  [items, targetCurrency],
  () => {
    if (isCartOrCheckoutActive()) {
      scheduleServerTotal()
    }
  },
  { deep: true, immediate: true },
)

export function useCart() {
  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  /** Number of distinct cart lines. `count` is the SUM OF QUANTITIES, so it
   *  must not be used for "N products" / "N items" labels. */
  const lineCount = computed(() => items.value.length)
  /** Backend ceiling total — null until the backend quotes the cart. */
  const displayTotal = computed(() => serverTotal.value?.total ?? null)
  const displaySubtotal = computed(() => serverTotal.value?.subtotal ?? null)
  /** A total is only trustworthy once the cart is quoted AND no line failed
   *  currency conversion. Anything else means the buyer would be committing to
   *  a figure nobody can compute. */
  const totalKnown = computed(() => serverTotal.value != null && unconvertedIds.value.length === 0)
  const totalPending = computed(() => items.value.length > 0 && !totalKnown.value)
  /** Gate for every CTA that spends money (order / RFQ). */
  const canSubmitOrder = computed(() => items.value.length > 0 && totalKnown.value)
  const currency = computed(() => targetCurrency.value)
  const currencyCode = computed(() => targetCurrency.value)
  const displayCurrency = computed(() => targetCurrency.value)

  function currencyOf(p: ProductDto): string {
    return p.currencyCode || p.currency || 'USD'
  }

  function setTargetCurrency(code: string) {
    const upper = code.trim().toUpperCase()
    if (!upper) return
    targetCurrency.value = upper
    scheduleServerTotal()
  }

  /** Native database unit price — the only unit price used client-side. */
  function getNativePrice(product: ProductDto): number {
    return product.price
  }

  /** Backend-quoted converted unit for a line, if the server priced it. */
  function getServerLine(productId: string): ServerCartLineTotal | null {
    return serverTotal.value?.lines.get(productId) ?? null
  }

  function add(product: ProductDto, qty = 1) {
    // Multi-currency now supported via conversion to targetCurrency
    // Auto-set target to first product's currency if not yet chosen or still default USD with no addresses
    if (!items.value.length && !localStorage.getItem(TC_KEY) && !localStorage.getItem(LEGACY_TC_KEY)) {
      // keep target as is; will be overridden by address logic in views
    }
    const qtyClamped = Math.max(product.minOrderQty, qty)
    const existing = items.value.find(i => i.product.id === product.id)
    if (existing) {
      existing.quantity = clampQty(product, existing.quantity + qtyClamped)
    } else {
      items.value.push({ product, quantity: clampQty(product, qtyClamped) })
    }
    persist()
  }

  function setQty(productId: string, qty: number) {
    const it = items.value.find(i => i.product.id === productId)
    if (!it) return
    if (qty <= 0) remove(productId)
    else { it.quantity = clampQty(it.product, qty); persist() }
  }

  function remove(productId: string) {
    items.value = items.value.filter(i => i.product.id !== productId)
    persist()
  }

  function clear() {
    items.value = []
    quoteNote.value = ''
    localStorage.removeItem(CART_KEY)
    localStorage.removeItem(LEGACY_CART_KEY)
    localStorage.removeItem(NOTE_KEY)
    localStorage.removeItem(LEGACY_NOTE_KEY)
    void clearServerCart().catch(() => {})
  }

  function setNote(v: string) {
    quoteNote.value = v
    localStorage.setItem(NOTE_KEY, v)
    localStorage.setItem(LEGACY_NOTE_KEY, v)
  }

  function toOrderItems(): CreateOrderItemPayload[] {
    return items.value.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      // `convertedUnit` is already rounded up at the quote; rounding again here
      // is what used to make the order price disagree with the displayed one.
      unitPrice: getServerLine(i.product.id)?.convertedUnit ?? Math.ceil(getNativePrice(i.product)),
    }))
  }

  function toRfqItems(): CreateRfqItemPayload[] {
    return items.value.map((i) => {
      const fromCurrency = (i.product.currencyCode || i.product.currency || 'USD').toUpperCase()
      const tCur = targetCurrency.value.toUpperCase()
      const nativePrice = Number(i.product.price)
      const serverLine = getServerLine(i.product.id)
      // Same figure the cart displays and the order payload sends.
      const convertedUnit = serverLine?.convertedUnit ?? Math.ceil(nativePrice)
      const rate = serverLine?.rate

      // Encode base + requested price and the rate into the note: the API
      // stores a single unitPrice, so this tag is how the provider sees which
      // currency the buyer is negotiating in and at what rate.
      const currencyNote = formatRfqCurrencyNote({
        baseCurrency: fromCurrency,
        requestedCurrency: tCur,
        basePrice: nativePrice,
        requestedPrice: convertedUnit,
        rate,
      })

      return {
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: convertedUnit,
        notes: currencyNote,
      }
    })
  }

  function toDisplayCurrency(): string {
    return targetCurrency.value
  }

  // For quote-approved order: build items from quote with repriced unitPrice
  function toOrderItemsFromQuote(quoteItems: { productId: string; quantity: number; unitPrice: number }[]): CreateOrderItemPayload[] {
    return quoteItems.map(q => ({ productId: q.productId, quantity: q.quantity, unitPrice: q.unitPrice }))
  }

  // Best-effort server sync when authenticated as a buyer (never for admin/seller).
  // Fire-and-forget: localStorage remains the offline fallback, sync failures
  // never block checkout. Guests stay local-only (backend 401s anon carts).
  // Re-sync on login so guest items added before sign-in merge to server.
  if (typeof window !== 'undefined' && import.meta.env?.MODE !== 'test') {
    if (!serverSyncScheduled) {
      serverSyncScheduled = true
      const auth = services.authService
      const isBuyerRole = () => {
        if (!auth.isAuthenticated) return false
        return !auth.isAdmin.value && !auth.isSales.value && !auth.isProvider.value
      }
      if (auth.isAdmin.value || auth.isSales.value || auth.isProvider.value) {
        serverCartId.value = null
        removeCartId()
      } else if (isBuyerRole()) {
        void syncToServer()
      }
      watch(
        () => auth.user.value?.id,
        (id, prev) => {
          if (auth.isAdmin.value || auth.isSales.value || auth.isProvider.value) {
            serverCartId.value = null
            removeCartId()
          } else if (id && id !== prev && isBuyerRole()) {
            void syncToServer()
          }
        },
      )
    }
  }

  return { items, count, lineCount, displayTotal, displaySubtotal, totalKnown, totalPending, canSubmitOrder, serverTotal, serverTotalLoading, targetCurrency, unconvertedIds, currency, currencyCode, displayCurrency, quoteNote, serverCartId, add, setQty, remove, clear, setNote, toOrderItems, toRfqItems, toDisplayCurrency, toOrderItemsFromQuote, getNativePrice, getServerLine, maxQtyFor, resolveCurrencyId, setTargetCurrency, refreshServerTotal, currencyOf, getSessionId, syncToServer, clearServerCart }
}

export { maxQtyFor, MADE_TO_ORDER_MAX_QTY }
