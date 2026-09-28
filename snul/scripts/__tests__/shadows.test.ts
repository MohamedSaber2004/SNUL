import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findSelfReferences } from '../lib/css.mjs'

const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/assets')
const tokensCss = readFileSync(join(assets, 'tokens.css'), 'utf8')

describe('shadow tokens are not shadowed by the alias layer', () => {
  it('tokens.css declares no self-referential token', () => {
    expect(findSelfReferences(tokensCss)).toEqual([])
  })

  it('does not redefine --shadow-sm', () => {
    expect(tokensCss).not.toMatch(/^\s*--shadow-sm\s*:/m)
  })

  it('does not redefine --shadow-md', () => {
    expect(tokensCss).not.toMatch(/^\s*--shadow-md\s*:/m)
  })

  it('does not remap --shadow-xl onto --shadow-lg', () => {
    expect(tokensCss).not.toMatch(/--shadow-xl\s*:\s*var\(--shadow-lg\)/)
  })

  it('keeps the legitimate aliases', () => {
    expect(tokensCss).toMatch(/--shadow-card\s*:\s*var\(--shadow-md\)/)
    expect(tokensCss).toMatch(/--shadow-hover\s*:\s*var\(--shadow-lg\)/)
  })
})
