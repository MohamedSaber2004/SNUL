import { describe, it, expect, afterEach } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import AdminLayout from '../AdminLayout.vue'

let app: App | null = null
let host: HTMLDivElement | null = null

const mountLayout = async (): Promise<HTMLDivElement> => {
  host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp({ render: () => h(AdminLayout, null, { default: () => h('p', 'slot-content') }) })
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

describe('AdminLayout dashboard shell', () => {
  it('renders the unified dashboard rail with core section links', async () => {
    const el = await mountLayout()
    expect(el.querySelector('.admin-rail')).not.toBeNull()
    const hrefs = [...el.querySelectorAll('.admin-link')].map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/admin')
    expect(hrefs).toContain('/admin/orders')
    expect(hrefs).toContain('/admin/about')
    expect(hrefs).not.toContain('/admin/sales')
  })

  it('renders page content inside the shell main area', async () => {
    const el = await mountLayout()
    expect(el.querySelector('.admin-main__inner p')?.textContent).toBe('slot-content')
  })

  it('renders the mobile pill nav', async () => {
    const el = await mountLayout()
    const pills = [...el.querySelectorAll('.admin-mobile-pill')]
    expect(pills.length).toBeGreaterThan(0)
    expect(pills.map((a) => a.getAttribute('href'))).toContain('/admin/orders')
  })
})
