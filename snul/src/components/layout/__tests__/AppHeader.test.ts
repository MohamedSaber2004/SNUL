import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readHeaderStyle = async (): Promise<string> => {
  const source = await readFile(resolve(process.cwd(), 'src/components/layout/AppHeader.vue'), 'utf8')
  const match = source.match(/<style scoped>([\s\S]*?)<\/style>/)
  if (!match) throw new Error('AppHeader scoped styles not found')
  return match[1]
}

describe('AppHeader search styling', () => {
  it('keeps the focused navbar search input background transparent', async () => {
    const headerStyle = await readHeaderStyle()

    expect(headerStyle).toMatch(/\.header__search input:focus\s*\{[^}]*background:\s*transparent\s*!important/)
    expect(headerStyle).toMatch(/\.header__mobile-search-form input:focus\s*\{[^}]*background:\s*transparent\s*!important/)
  })
})
