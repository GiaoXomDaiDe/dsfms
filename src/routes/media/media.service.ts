import { Injectable } from '@nestjs/common'
import { unlink } from 'fs/promises'
import path from 'path'
import {
  DeleteMediaObjectBodyType,
  PresignedUploadDocBodyType,
  PresignedUploadFileBodyType
} from '~/routes/media/media.model'
import { S3Service } from '~/shared/services/s3.service'

@Injectable()
export class MediaService {
  constructor(private readonly s3Service: S3Service) {}

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
    const uploads = files.map(async (file, index) => {
      const extension = path.extname(file.originalname)
      const controlledFilename = this.generateControlledFilename(
        extension,
        type,
        files.length > 1 ? `${userId}_${index + 1}` : userId
      )
      const key = `docs/${controlledFilename}`

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
}
