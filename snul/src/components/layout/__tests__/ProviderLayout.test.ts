import { describe, it, expect, afterEach } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import ProviderLayout from '../ProviderLayout.vue'

let app: App | null = null
let host: HTMLDivElement | null = null

/**
 * Mounted with plain createApp (no @vue/test-utils in this project).
 * RouterLink is stubbed to a plain anchor so rail hrefs are assertable.
 */
const mountLayout = async (): Promise<HTMLDivElement> => {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({ render: () => h(ProviderLayout, null, { default: () => h('p', 'slot-content') }) })
  app.component('RouterLink', {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : \'\'"><slot /></a>',
  })
  app.mount(host)
  await nextTick()
  return host
}

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = null
  host = null
})

describe('ProviderLayout dashboard shell', () => {
  it('renders the unified dashboard rail with catalog + categories links', async () => {
    const el = await mountLayout()
    const rail = el.querySelector('.admin-rail')
    expect(rail).not.toBeNull()
    const hrefs = [...el.querySelectorAll('.admin-link')].map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/provider/catalog')
    expect(hrefs).toContain('/provider/categories')
  })

  it('renders page content inside the shell main area', async () => {
    const el = await mountLayout()
    expect(el.querySelector('.admin-main__inner p')?.textContent).toBe('slot-content')
  })

  it('renders the mobile pill nav with the same destinations', async () => {
    const el = await mountLayout()
    const hrefs = [...el.querySelectorAll('.admin-mobile-pill')].map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/provider/catalog')
    expect(hrefs).toContain('/provider/categories')
  })
})
