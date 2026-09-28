
export enum MediaType {
  Image = 0,
  Video = 1,
  Audio = 2,
  File = 3,
}

export enum AttachmentPlace {
  Default = 0,
  Providers = 1,
  Users = 2,
}

export interface FileResponseDto {
  filePath: string | null
  fileName: string | null
  contentType: string | null
  success: boolean
  errorMessage: string | null
}

export interface UploadFilePayload {
  file: File
  place: number
  fileType: number
}

export interface UploadMultiplePayload {
  images?: File[]
  imagesPlace?: number
  videos?: File[]
  videosPlace?: number
  audios?: File[]
  audiosPlace?: number
  documents?: File[]
  documentsPlace?: number
}

export interface ReplaceFilePayload {
  name: string
  file: File
  place: number
  fileType: number
}

export const ALLOWED_EXTENSIONS: Record<number, string[]> = {
  [MediaType.Image]: [
    '.jpg',
    '.jpeg',
    '.jpe',
    '.jif',
    '.jfif',
    '.jfi',
    '.png',
    '.svg',
    '.svgz',
    '.webp',
    '.gif',
    '.bmp',
    '.dib',
    '.ico',
    '.tiff',
    '.tif',
    '.avif',
    '.heic',
    '.heif',
  ],
  [MediaType.Video]: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.webm'],
  [MediaType.Audio]: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
  [MediaType.File]: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.rar', '.7z', '.csv'],
}

export const MEDIA_MAX_SIZE_KB: Record<number, number> = {
  [MediaType.Image]: 15 * 1024,
  [MediaType.Video]: 100 * 1024,
  [MediaType.Audio]: 20 * 1024,
  [MediaType.File]: 25 * 1024,
}

export function guessMediaTypeFromFile(file: File): number {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  for (const [type, exts] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (exts.includes(ext)) return Number(type)
  }
  return MediaType.File
}
