import { describe, it, expect, afterEach } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import BaseButton from '../BaseButton.vue'

let app: App | null = null
let host: HTMLDivElement | null = null

const mountButton = async (
  props: Record<string, unknown> = {},
  slotContent: string = 'Click me',
): Promise<HTMLButtonElement> => {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({
    render: () => h(BaseButton, props, () => slotContent),
  })
  app.mount(host)
  await nextTick()
  return host.querySelector('button') as HTMLButtonElement
}

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = null
  host = null
})

describe('BaseButton', () => {
  describe('Rendering', () => {
    it('renders button with slot content', async () => {
      const btn = await mountButton({}, 'Click me')
      expect(btn).toBeTruthy()
      expect(btn.textContent).toContain('Click me')
    })

    it('renders with correct type', async () => {
      const btn = await mountButton({ type: 'submit' }, 'Submit')
      expect(btn.getAttribute('type')).toBe('submit')
    })
  })

  describe('Variants', () => {
    const variants = ['primary', 'secondary', 'ghost', 'outline', 'danger', 'gold'] as const
    for (const variant of variants) {
      it(`renders ${variant} variant`, async () => {
        const btn = await mountButton({ variant })
        expect(btn.classList.contains(`btn--${variant}`)).toBe(true)
      })
    }
  })

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const size of sizes) {
      it(`renders ${size} size`, async () => {
        const btn = await mountButton({ size })
        expect(btn.classList.contains(`btn--${size}`)).toBe(true)
      })
    }
  })

  describe('States', () => {
    it('disables button when disabled prop is true', async () => {
      const btn = await mountButton({ disabled: true })
      expect(btn.disabled).toBe(true)
    })

    it('disables button and shows spinner when loading prop is true', async () => {
      const btn = await mountButton({ loading: true })
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('aria-busy')).toBe('true')
      expect(btn.querySelector('.btn__spinner')).toBeTruthy()
    })

    it('applies block class when block prop is true', async () => {
      const btn = await mountButton({ block: true })
      expect(btn.classList.contains('btn--block')).toBe(true)
    })
  })
})
