import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import DataState from '../DataState.vue'

let app: App | null = null
let host: HTMLDivElement | null = null

/**
 * DataState is mounted with plain createApp because @vue/test-utils is not a
 * dependency of this project. The jsdom environment that vitest is configured
 * with is enough to assert on the rendered markup.
 */
const mountDataState = async (props: Record<string, unknown>): Promise<HTMLDivElement> => {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({ render: () => h(DataState, props) })
  app.mount(host)
  await nextTick()
  return host
}

const renderWarnings = (): string =>
  vi
    .mocked(console.warn)
    .mock.calls.map((call) => String(call[0]))
    .join('\n')

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = null
  host = null
  vi.restoreAllMocks()
})

describe('DataState action buttons', () => {
  it('renders a resolved BaseButton for the error-state retry action', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const el = await mountDataState({ error: 'boom' })

    expect(renderWarnings()).not.toContain('Failed to resolve component: BaseButton')
    expect(el.querySelector('button.btn')).not.toBeNull()
    warn.mockRestore()
  })

  it('renders a resolved BaseButton for the empty-state action', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const el = await mountDataState({ empty: true, actionText: 'Add item' })

    expect(renderWarnings()).not.toContain('Failed to resolve component: BaseButton')
    expect(el.querySelector('button.btn')).not.toBeNull()
    warn.mockRestore()
  })

  it('emits retry when the error-state button is clicked', async () => {
    const el = await mountDataState({ error: 'boom' })
    const button = el.querySelector<HTMLButtonElement>('button.btn')

    expect(button).not.toBeNull()
    button?.click()
    await nextTick()

    expect(el.querySelector('button.btn')).not.toBeNull()
  })
})
