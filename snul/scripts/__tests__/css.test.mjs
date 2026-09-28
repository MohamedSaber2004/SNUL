import { describe, it, expect } from 'vitest'
import {
  parseTokenDefinitions,
  findSelfReferences,
  findHexLiterals,
  findVarReferences,
} from '../lib/css.mjs'

describe('parseTokenDefinitions', () => {
  it('reads name and value from a :root block', () => {
    const css = ':root { --a: #fff; --b: var(--a); }'
    const defs = parseTokenDefinitions(css)
    expect(defs.get('a').value).toBe('#fff')
    expect(defs.get('b').value).toBe('var(--a)')
  })

  it('ignores declarations outside any block', () => {
    const css = '--stray: 1px; :root { --a: 2px; }'
    expect(parseTokenDefinitions(css).has('stray')).toBe(false)
  })

  it('handles a token whose value spans multiple lines', () => {
    const css = ':root { --shadow: 0 1px 2px rgba(0,0,0,.1),\n    0 2px 4px rgba(0,0,0,.2); }'
    expect(parseTokenDefinitions(css).get('shadow').value).toContain('0 2px 4px')
  })

  it('records the line number of each definition', () => {
    const defs = parseTokenDefinitions(':root {\n  --a: 1px;\n}')
    expect(defs.get('a').line).toBe(2)
  })

  it('records the line number of an unindented definition', () => {
    // The `{` is immediately followed by a newline here, so the missing +1 in
    // the line offset is not absorbed by an indent character.
    expect(parseTokenDefinitions(':root {\n--a: 1px;\n}').get('a').line).toBe(2)
  })

  it('captures and trims a final declaration that omits the semicolon', () => {
    expect(parseTokenDefinitions(':root { --a:    #fff   }').get('a').value).toBe('#fff')
  })

  it('ignores a closing brace inside a comment', () => {
    const defs = parseTokenDefinitions(':root { --a: 1px; /* } */ --b: 2px; }')
    expect(defs.get('a').value).toBe('1px')
    expect(defs.get('b').value).toBe('2px')
  })

  it('reports a duplicate definition without overwriting the first value', () => {
    const defs = parseTokenDefinitions(':root {\n  --a: 1px;\n}\n.dark {\n  --a: 2px;\n}')
    expect(defs.get('a').value).toBe('1px')
    expect(defs.duplicates).toEqual([{ name: 'a', value: '2px', line: 5 }])
  })

  it('reports no duplicates when a name is defined once', () => {
    expect(parseTokenDefinitions(':root { --a: 1px; --b: 2px; }').duplicates).toEqual([])
  })

  it('finds a definition inside a nested at-rule block', () => {
    const defs = parseTokenDefinitions('@media { .a {} :root { --inside: 1px } }')
    expect(defs.get('inside').value).toBe('1px')
  })
})

describe('findSelfReferences', () => {
  it('flags a token whose value references itself', () => {
    const css = ':root { --shadow-sm: var(--shadow-sm); }'
    expect(findSelfReferences(css)).toEqual(['shadow-sm'])
  })

  it('flags self-reference with a fallback, e.g. var(--x, red)', () => {
    const css = ':root { --x: var(--x, red); }'
    expect(findSelfReferences(css)).toEqual(['x'])
  })

  it('does not flag a token referencing a different token', () => {
    const css = ':root { --a: var(--b); }'
    expect(findSelfReferences(css)).toEqual([])
  })

  it('does not flag a token that merely shares a prefix', () => {
    const css = ':root { --shadow-sm: var(--shadow-sm-md); }'
    expect(findSelfReferences(css)).toEqual([])
  })

  it('returns every offender when several are broken', () => {
    const css = ':root { --a: var(--a); --b: 1px; --c: var(--c); }'
    expect(findSelfReferences(css).sort()).toEqual(['a', 'c'])
  })

  it('does not treat a commented-out self-reference as a real one', () => {
    expect(findSelfReferences('/* :root { --x: var(--x); } */')).toEqual([])
  })
})

describe('findHexLiterals', () => {
  it('finds a 3-digit hex', () => {
    expect(findHexLiterals('color: #fff;')).toHaveLength(1)
  })

  it('finds a 6-digit hex', () => {
    expect(findHexLiterals('background: #0C63B8;')).toHaveLength(1)
  })

  it('ignores a hex-like word inside an identifier', () => {
    expect(findHexLiterals('.note { content: "#ffffffish"; }')).toHaveLength(0)
  })

  it('ignores rgba() and hsl()', () => {
    expect(findHexLiterals('box-shadow: 0 0 0 1px #fff, 0 0 0 3px rgba(1,2,3,.18);')).toHaveLength(1)
    expect(findHexLiterals('background: linear-gradient(hsl(210 40% 50%, .2), #000);')).toHaveLength(1)
  })

  it('ignores a hex followed by a hyphen', () => {
    expect(findHexLiterals('#fff-')).toHaveLength(0)
  })

  it('finds several literals in one declaration block', () => {
    expect(findHexLiterals('background: linear-gradient(#fff, #000);')).toHaveLength(2)
  })
})

describe('findVarReferences', () => {
  it('lists referenced token names in source order', () => {
    expect(findVarReferences('var(--b) var(--a)')).toEqual(['b', 'a'])
  })

  it('ignores the fallback argument', () => {
    expect(findVarReferences('var(--missing, var(--fallback))')).toEqual(['missing', 'fallback'])
  })

  it('de-duplicates repeated references', () => {
    expect(findVarReferences('var(--a) var(--a)')).toEqual(['a'])
  })
})
