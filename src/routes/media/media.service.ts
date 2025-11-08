import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { unlink } from 'fs/promises'
import mime from 'mime-types'
import path from 'path'
import { Readable } from 'stream'
import {
  DeleteMediaObjectBodyType,
  OnlyOfficeCallbackBodyType,
  OnlyOfficeCallbackResType,
  PresignedUploadDocBodyType,
  PresignedUploadFileBodyType,
  UploadDocFromUrlBodyType,
  UploadDocFromUrlResType
} from '~/routes/media/media.model'
import { S3Service } from '~/shared/services/s3.service'

@Injectable()
export class MediaService {
  private static readonly ONLYOFFICE_SAVE_STATUSES = new Set([2, 6, 7])
  private readonly logger = new Logger(MediaService.name)

  constructor(
    private readonly s3Service: S3Service,
    private readonly httpService: HttpService
  ) {}

  private generateControlledFilename(extension: string, type: string = 'file', userId: string): string {
    return `${type}_${userId}${extension}`
  }

  async uploadFile(files: Array<Express.Multer.File>, type: string, userId: string) {
    const uploads = files.map(async (file, index) => {
      const extension = path.extname(file.originalname)
      const controlledFilename = this.generateControlledFilename(
        extension,
        type,
        files.length > 1 ? `${userId}_${index + 1}` : userId
      )
      const key = `images/${controlledFilename}`

      try {
        const uploadResult = await this.s3Service.uploadedFile({
          filename: key,
          filepath: file.path,
          contentType: file.mimetype
        })

        return {
          id: uploadResult.Key ?? key,
          url: uploadResult.Location ?? this.s3Service.getObjectUrl(key)
        }
      } finally {
        await unlink(file.path)
      }
    })

    const result = await Promise.all(uploads)

    return {
      data: result
    }
  }

  async getPresignUrl(body: PresignedUploadFileBodyType, userId: string) {
    const controlledFilename = this.generateControlledFilename(body.extension, body.type, userId)
    const key = `images/${controlledFilename}`
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient(key, 300)
    const url = presignedUrl.split('?')[0]
    return {
      presignedUrl,
      url,
      id: key
    }
  }

  async uploadDocFile(files: Array<Express.Multer.File>, type: string, userId: string) {
    this.logger.debug(`uploadDocFile invoked with ${files.length} file(s) for type=${type} userId=${userId}`)

    const uploads = files.map(async (file, index) => {
      const extension = path.extname(file.originalname)
      const controlledFilename = this.generateControlledFilename(
        extension,
        type,
        files.length > 1 ? `${userId}_${index + 1}` : userId
      )
      const key = `docs/${controlledFilename}`

      this.logger.debug(`Uploading doc file`, {
        originalName: file.originalname,
        key,
        tempPath: file.path,
        index
      })

      try {
        const uploadResult = await this.s3Service.uploadedFile({
          filename: key,
          filepath: file.path,
          contentType: file.mimetype
        })

        const resolved = {
          id: uploadResult.Key ?? key,
          url: uploadResult.Location ?? this.s3Service.getObjectUrl(key)
        }

        this.logger.debug(`Upload succeeded`, resolved)

        return resolved
      } catch (error) {
        this.logger.error(
          `Upload failed for ${file.originalname} -> ${key}: ${error instanceof Error ? error.message : error}`,
          error instanceof Error ? error.stack : undefined
        )
        throw error
      } finally {
        try {
          await unlink(file.path)
        } catch (cleanupError) {
          this.logger.warn(
            `Failed to remove temp file ${file.path}: ${
              cleanupError instanceof Error ? cleanupError.message : cleanupError
            }`
          )
        }
      }
    })

    try {
      const result = await Promise.all(uploads)
      this.logger.debug(`uploadDocFile completed with ${result.length} item(s)`)
      return {
        data: result
      }
    } catch (error) {
      this.logger.error(
        `uploadDocFile encountered an error: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined
      )
      throw error
    }
  }

  async getDocPresignUrl(body: PresignedUploadDocBodyType, userId: string) {
    const controlledFilename = this.generateControlledFilename(body.extension, body.type, userId)
    const key = `docs/${controlledFilename}`
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient(key, 600)
    const url = presignedUrl.split('?')[0]
    return {
      presignedUrl,
      url,
      id: key
    }
  }

  async deleteObject({ key }: DeleteMediaObjectBodyType) {
    await this.s3Service.deleteObject(key)
  }

  async uploadDocFromUrl({ fileName, sourceUrl }: UploadDocFromUrlBodyType): Promise<UploadDocFromUrlResType> {
    const parsed = path.parse(fileName)
    const baseName = this.sanitizeFilename(parsed.name, 'document')
    const response = await this.httpService.axiosRef.get<Readable>(sourceUrl, { responseType: 'stream' })
    const headerContentType = this.extractContentType(response.headers?.['content-type'])
    const extension = parsed.ext || this.inferExtensionFromContentType(headerContentType, '.docx')
    const normalizedExtension = this.normalizeExtension(extension, '.docx')
    const s3Key = `docs/${Date.now()}_${baseName}${normalizedExtension}`

    try {
      const uploadResult = await this.s3Service.uploadStream({
        key: s3Key,
        body: response.data,
        contentType: headerContentType ?? (mime.lookup(normalizedExtension) || 'application/octet-stream')
      })

      return {
        data: [
          {
            id: uploadResult.key,
            url: uploadResult.url
          }
        ]
      }
    } finally {
      if (typeof response.data.destroy === 'function') {
        response.data.destroy()
      }
    }
  }

  async handleOnlyOfficeCallback(payload: OnlyOfficeCallbackBodyType): Promise<OnlyOfficeCallbackResType> {
    console.log('Payload come from callback:', JSON.stringify(payload, null, 2))
    if (!MediaService.ONLYOFFICE_SAVE_STATUSES.has(payload.status) || !payload.url) {
      return { error: 0 }
    }

    const timestamp = Date.now()
    const safeKeySegment = this.sanitizeKeySegment(payload.key)
    const keyPrefix = `docs/onlyoffice/${safeKeySegment}`
    const documentKey = `${keyPrefix}_${timestamp}${this.normalizeExtension(payload.filetype, '.docx')}`

    try {
      await this.uploadFromSourceUrl(payload.url, documentKey)

      if (payload.changesurl) {
        await this.uploadFromSourceUrl(payload.changesurl, `${keyPrefix}_${timestamp}-changes.zip`)
      }

      if (payload.formsdataurl) {
        await this.uploadFromSourceUrl(payload.formsdataurl, `${keyPrefix}_${timestamp}-forms.json`, 'application/json')
      }

      return { error: 0 }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Failed to process OnlyOffice callback for key ${payload.key}: ${message}`,
        error instanceof Error ? error.stack : undefined
      )
      return { error: 1 }
    }
  }

  private sanitizeFilename(value: string, fallback: string): string {
    const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    return sanitized.length > 0 ? sanitized : fallback
  }

  private sanitizeKeySegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_.-]/g, '_')
  }

  private normalizeExtension(extension?: string, fallback: string = '.bin'): string {
    if (!extension) {
      return fallback
    }

    const trimmed = extension.trim()
    if (!trimmed) {
      return fallback
    }

    const normalized = trimmed.startsWith('.') ? trimmed : `.${trimmed}`
    const safe = normalized.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
    return safe || fallback
  }

  private inferExtensionFromContentType(contentType?: string, fallback: string = '.bin'): string {
    if (!contentType) {
      return fallback
    }

    const inferred = mime.extension(contentType)
    if (!inferred) {
      return fallback
    }

    return this.normalizeExtension(inferred, fallback)
  }

  private extractContentType(rawHeader: unknown): string | undefined {
    if (!rawHeader) {
      return undefined
    }

    if (Array.isArray(rawHeader)) {
      return rawHeader[0]
    }

    return typeof rawHeader === 'string' ? rawHeader : undefined
  }

  private async uploadFromSourceUrl(sourceUrl: string, key: string, overrideContentType?: string) {
    const response = await this.httpService.axiosRef.get<Readable>(sourceUrl, { responseType: 'stream' })
    this.logger.debug(
      `Fetched source URL ${sourceUrl} with status ${response.status}`,
      typeof response.headers === 'object' ? { 'content-type': response.headers['content-type'] } : undefined
    )
    try {
      const headerContentType = this.extractContentType(response.headers?.['content-type'])
      const contentType = overrideContentType ?? headerContentType ?? (mime.lookup(key) || 'application/octet-stream')

      return await this.s3Service.uploadStream({
        key,
        body: response.data,
        contentType
      })
    } finally {
      if (typeof response.data.destroy === 'function') {
        response.data.destroy()
      }
    }
  }
}
