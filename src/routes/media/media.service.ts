import { HttpService } from '@nestjs/axios'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AxiosError } from 'axios'
import { unlink } from 'fs/promises'
import mime from 'mime-types'
import path from 'path'
import { Readable } from 'stream'
import {
  DeleteMediaObjectBodyType,
  OnlyOfficeCallbackBodyType,
  OnlyOfficeCallbackResType,
  OnlyOfficeForceSaveBodyType,
  OnlyOfficeForceSaveResType,
  PresignedUploadDocBodyType,
  PresignedUploadFileBodyType,
  UploadDocFromUrlBodyType,
  UploadDocFromUrlResType
} from '~/routes/media/media.model'
import envConfig from '~/shared/config'
import { S3Service } from '~/shared/services/s3.service'

@Injectable()
export class MediaService {
  private static readonly ONLYOFFICE_SAVE_STATUSES = new Set([2, 6, 7])
  private static readonly ONLYOFFICE_RESULT_TTL_MS = 5 * 60 * 1000
  private readonly logger = new Logger(MediaService.name)
  private readonly onlyOfficeResults = new Map<string, { objectKey: string; url: string; savedAt: number }>()

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
    console.log('Payload received from OnlyOffice callback:', JSON.stringify(payload, null, 2))
    if (!MediaService.ONLYOFFICE_SAVE_STATUSES.has(payload.status) || !payload.url) {
      return { error: 0 }
    }

    const timestamp = Date.now()
    const safeKeySegment = this.sanitizeKeySegment(payload.key)
    const keyPrefix = `docs/onlyoffice/${safeKeySegment}`
    const documentKey = `${keyPrefix}_${timestamp}${this.normalizeExtension(payload.filetype, '.docx')}`

    try {
      const { key: uploadedObjectKey, url: uploadedObjectUrl } = await this.uploadFromSourceUrl(
        payload.url,
        documentKey
      )

      if (payload.changesurl) {
        await this.uploadFromSourceUrl(payload.changesurl, `${keyPrefix}_${timestamp}-changes.zip`)
      }

      if (payload.formsdataurl) {
        await this.uploadFromSourceUrl(payload.formsdataurl, `${keyPrefix}_${timestamp}-forms.json`, 'application/json')
      }

      this.pruneExpiredOnlyOfficeResults()
      this.onlyOfficeResults.set(payload.key, {
        objectKey: uploadedObjectKey,
        url: uploadedObjectUrl,
        savedAt: Date.now()
      })
      this.logger.debug(`Stored OnlyOffice save result for key=${payload.key} -> ${uploadedObjectKey}`)

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

  async forceSaveOnlyOfficeDocument(
    { key, userdata }: OnlyOfficeForceSaveBodyType,
    userId?: string
  ): Promise<OnlyOfficeForceSaveResType> {
    this.logger.debug('Force save request received', {
      key,
      hasExplicitUserdata: Boolean(userdata),
      resolvedUserId: userId
    })

    const commandUrl = envConfig.ONLYOFFICE_COMMAND_SERVICE_URL

    if (!commandUrl) {
      this.logger.error('ONLYOFFICE_COMMAND_SERVICE_URL environment variable is not configured')
      throw new InternalServerErrorException('OnlyOffice command service is not configured')
    }

    const effectiveUserData = userdata ?? userId
    const basePayload: Record<string, unknown> = { c: 'forcesave', key }

    if (effectiveUserData) {
      basePayload.userdata = effectiveUserData
    }

    const requestBody: Record<string, unknown> = { ...basePayload }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }

    const jwtSecret = envConfig.ONLYOFFICE_JWT_SECRET

    if (jwtSecret) {
      const jwtService = new JwtService({ secret: jwtSecret })
      const tokenPayload = { payload: { ...basePayload } }
      const token = jwtService.sign(tokenPayload)
      requestBody.token = token
      headers.Authorization = `Bearer ${token}`
      this.logger.debug('JWT token attached to OnlyOffice command request', {
        tokenPayloadKeys: Object.keys(basePayload)
      })
    }

    try {
      this.logger.debug('Sending force save command to OnlyOffice', {
        commandUrl,
        payloadKeys: Object.keys(requestBody)
      })

      const { data } = await this.httpService.axiosRef.post(commandUrl, requestBody, {
        headers
      })

      const errorCode = typeof data?.error === 'number' ? data.error : undefined

      this.logger.debug('OnlyOffice command response received', {
        key,
        errorCode,
        rawResponse: data
      })

      if (errorCode === 0) {
        return { error: 0, message: 'Force save completed successfully' }
      }

      if (errorCode === 4) {
        return { error: 4, message: 'No changes detected, skipping force save' }
      }

      this.logger.error(`Unexpected OnlyOffice response for key=${key}`, {
        errorCode,
        data
      })

      throw new BadRequestException(`OnlyOffice force save failed with error code ${errorCode ?? 'unknown'}`)
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error
      }

      const axiosError = error as AxiosError
      const status = axiosError?.response?.status
      const responseData = axiosError?.response?.data

      this.logger.error(
        `OnlyOffice force save request failed for key=${key} (status=${status ?? 'n/a'})`,
        typeof responseData === 'object' ? responseData : { response: responseData }
      )

      throw new InternalServerErrorException('Failed to trigger OnlyOffice force save')
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

  getOnlyOfficeResult(documentKey: string) {
    const record = this.onlyOfficeResults.get(documentKey)

    if (!record) {
      throw new NotFoundException('No saved result found for this document')
    }

    const isExpired = record.savedAt + MediaService.ONLYOFFICE_RESULT_TTL_MS < Date.now()
    if (isExpired) {
      this.onlyOfficeResults.delete(documentKey)
      throw new NotFoundException('Saved result has expired, please save the document again')
    }

    return {
      key: record.objectKey,
      url: record.url,
      savedAt: new Date(record.savedAt).toISOString()
    }
  }

  private pruneExpiredOnlyOfficeResults() {
    const now = Date.now()
    for (const [key, record] of this.onlyOfficeResults.entries()) {
      if (record.savedAt + MediaService.ONLYOFFICE_RESULT_TTL_MS < now) {
        this.onlyOfficeResults.delete(key)
      }
    }
  }
}
