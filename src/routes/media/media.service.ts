import { Injectable } from '@nestjs/common'
import { unlink } from 'fs/promises'
import path from 'path'
import { PresignedUploadDocBodyType, PresignedUploadFileBodyType } from '~/routes/media/media.model'
import { S3Service } from '~/shared/services/s3.service'

@Injectable()
export class MediaService {
  constructor(private readonly s3Service: S3Service) {}

  private generateControlledFilename(extension: string, type: string = 'file', userId: string): string {
    return `${type}_${userId}${extension}`
  }

  async uploadFile(files: Array<Express.Multer.File>, type: string, userId: string) {
    const result = await Promise.all(
      files.map((file, index) => {
        const extension = path.extname(file.originalname)
        const controlledFilename = this.generateControlledFilename(
          extension,
          type,
          files.length > 1 ? `${userId}_${index + 1}` : userId
        )
        return this.s3Service
          .uploadedFile({
            filename: 'images/' + controlledFilename,
            filepath: file.path,
            contentType: file.mimetype
          })
          .then((res) => {
            return { url: res.Location }
          })
          .catch((error) => {
            throw error
          })
      })
    )
    // Xóa file sau khi upload lên S3
    await Promise.all(
      files.map((file) => {
        return unlink(file.path)
      })
    )
    return {
      data: result
    }
  }

  async getPresignUrl(body: PresignedUploadFileBodyType, userId: string) {
    const controlledFilename = this.generateControlledFilename(body.extension, body.type, userId)
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient('images/' + controlledFilename, 300)
    const url = presignedUrl.split('?')[0]
    return {
      presignedUrl,
      url
    }
  }

  async uploadDocFile(files: Array<Express.Multer.File>, type: string, userId: string) {
    const result = await Promise.all(
      files.map((file, index) => {
        const extension = path.extname(file.originalname)
        const controlledFilename = this.generateControlledFilename(
          extension,
          type,
          files.length > 1 ? `${userId}_${index + 1}` : userId
        )
        return this.s3Service
          .uploadedFile({
            filename: 'docs/' + controlledFilename,
            filepath: file.path,
            contentType: file.mimetype
          })
          .then((res) => {
            return { url: res.Location }
          })
          .catch((error) => {
            throw error
          })
      })
    )
    // Xóa file sau khi upload lên S3
    await Promise.all(
      files.map((file) => {
        return unlink(file.path)
      })
    )
    return {
      data: result
    }
  }

  async getDocPresignUrl(body: PresignedUploadDocBodyType, userId: string) {
    const controlledFilename = this.generateControlledFilename(body.extension, body.type, userId)
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient('docs/' + controlledFilename, 600)
    const url = presignedUrl.split('?')[0]
    return {
      presignedUrl,
      url
    }
  }
}
