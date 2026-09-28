import type {
  FileResponseDto,
  ReplaceFilePayload,
  UploadFilePayload,
  UploadMultiplePayload,
} from '../models/attachment'

export interface UploadProgressHandler {
  (progress: number): void
}

export interface AttachmentRepository {
  uploadFile(payload: UploadFilePayload, onProgress?: UploadProgressHandler): Promise<string>
  uploadMultiple(payload: UploadMultiplePayload, onProgress?: UploadProgressHandler): Promise<string[]>
  replaceFile(payload: ReplaceFilePayload, onProgress?: UploadProgressHandler): Promise<string>
  downloadFile(place: number, fileName: string): Promise<FileResponseDto>
  deleteFile(name: string, place?: number, fileType?: number): Promise<boolean>
}
