const GENERIC_DOC_TITLES = new Set(['document-name', 'document', 'test', 'untitled', 'file'])

interface TitledDoc {
  title?: string | null
  fileUrl?: string | null
  docType?: string | null
}

export function docTitle(d: TitledDoc): string {
  const raw = (d.title || '').trim()
  if (raw && !GENERIC_DOC_TITLES.has(raw.toLowerCase())) return d.title as string
  const src = d.fileUrl || ''
  const base = (src.split('?')[0] ?? '').split('#')[0]?.split('/').pop() || ''
  const looksHashed = /[0-9a-f]{8,}/i.test(base) || /^[\w-]*_\w+\.\w+$/.test(base)
  if (!looksHashed) {
    const clean = base
      .replace(/^[0-9a-f-]*_?/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\.\w+$/, '')
      .trim()
    if (clean && clean.length > 2 && !/^[0-9a-f\s]{8,}$/i.test(clean)) return clean
  }
  return `${d.docType || 'Technical'} file`
}
