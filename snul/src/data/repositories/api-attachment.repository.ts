import { ATTACHMENT_ROUTES } from '../../config/api.config'
import type {
  FileResponseDto,
  ReplaceFilePayload,
  UploadFilePayload,
  UploadMultiplePayload,
} from '../../domain/models/attachment'
import type { AttachmentRepository, UploadProgressHandler } from '../../domain/ports/attachment-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

function extractFileName(raw: unknown): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        const parsed = JSON.parse(trimmed)
        return extractFileName(parsed)
      } catch {
      }
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const url = new URL(trimmed)
        const parts = url.pathname.split('/').filter(Boolean)
        return parts[parts.length - 1] || trimmed
      } catch {
      }
    }
    if (trimmed.startsWith('/files/')) return trimmed.slice(7)
    if (trimmed.startsWith('files/')) return trimmed.slice(6)
    return trimmed
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const candidate =
      obj.fileName ??
      obj.FileName ??
      obj.name ??
      obj.Name ??
      obj.filePath ??
      obj.FilePath ??
      obj.fileUrl ??
      obj.FileUrl ??
      obj.data ??
      obj.Data ??
      obj.storedName ??
      obj.StoredName
    if (candidate) return extractFileName(candidate)
  }
  return String(raw ?? '')
}

export class ApiAttachmentRepository implements AttachmentRepository {
  constructor(private readonly http: HttpClient) {}

  async uploadFile(payload: UploadFilePayload, onProgress?: UploadProgressHandler): Promise<string> {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('place', String(payload.place))
    form.append('fileType', String(payload.fileType))
    const res = await this.http.post<unknown>(ATTACHMENT_ROUTES.upload, form, { onUploadProgress: onProgress })
    return extractFileName(res)
  }

  async uploadMultiple(payload: UploadMultiplePayload, onProgress?: UploadProgressHandler): Promise<string[]> {
    const form = new FormData()
    if (payload.images?.length) {
      for (const f of payload.images) form.append('images', f)
      form.append('imagesPlace', String(payload.imagesPlace ?? 1))
    }
    if (payload.videos?.length) {
      for (const f of payload.videos) form.append('videos', f)
      form.append('videosPlace', String(payload.videosPlace ?? 1))
    }
    if (payload.audios?.length) {
      for (const f of payload.audios) form.append('audios', f)
      form.append('audiosPlace', String(payload.audiosPlace ?? 1))
    }
    if (payload.documents?.length) {
      for (const f of payload.documents) form.append('documents', f)
      form.append('documentsPlace', String(payload.documentsPlace ?? 1))
    }
    const res = await this.http.post<unknown>(ATTACHMENT_ROUTES.uploadMultiple, form, { onUploadProgress: onProgress })
    if (Array.isArray(res)) return res.map(extractFileName)
    if (res && typeof res === 'object') {
      const obj = res as Record<string, unknown>
      const list = obj.data ?? obj.Data ?? obj.fileNames ?? obj.FileNames ?? obj.files ?? obj.Files
      if (Array.isArray(list)) return list.map(extractFileName)
    }
    return [extractFileName(res)]
  }

  async replaceFile(payload: ReplaceFilePayload, onProgress?: UploadProgressHandler): Promise<string> {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('place', String(payload.place))
    form.append('fileType', String(payload.fileType))
    const res = await this.http.put<unknown>(ATTACHMENT_ROUTES.replace(payload.name), form, { onUploadProgress: onProgress })
    return extractFileName(res)
  }

  async downloadFile(place: number, fileName: string): Promise<FileResponseDto> {
    const qs = new URLSearchParams({ place: String(place), fileName })
    return this.http.get<FileResponseDto>(`${ATTACHMENT_ROUTES.download}?${qs.toString()}`, {
      showFeedback: false,
    })
  }

  async deleteFile(name: string, place: number = 1, fileType: number = 0): Promise<boolean> {
    try {
      const qs = new URLSearchParams({ place: String(place), fileType: String(fileType) })
      await this.http.del<unknown>(`${ATTACHMENT_ROUTES.delete(name)}?${qs.toString()}`, { showFeedback: false })
      return true
    } catch {
      return false
    }
  }
}
