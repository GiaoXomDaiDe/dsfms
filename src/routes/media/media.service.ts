import { Injectable } from '@nestjs/common'
import { unlink } from 'fs/promises'
import { PresignedUploadDocBodyType, PresignedUploadFileBodyType } from '~/routes/media/media.model'
import { generateRandomFilename } from '~/shared/helper'
import { S3Service } from '~/shared/services/s3.service'

@Injectable()
export class MediaService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadFile(files: Array<Express.Multer.File>) {
    const result = await Promise.all(
      files.map((file) => {
        return this.s3Service
          .uploadedFile({
            filename: 'images/' + file.filename,
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

  async getPresignUrl(body: PresignedUploadFileBodyType) {
    const randomFilename = generateRandomFilename(body.filename)
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient('images/' + randomFilename, 30)
    const url = presignedUrl.split('?')[0]
    return {
      presignedUrl,
      url
    }
  }

  async uploadDocFile(files: Array<Express.Multer.File>) {
    const result = await Promise.all(
      files.map((file) => {
        return this.s3Service
          .uploadedFile({
            filename: 'docs/' + file.filename,
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

  async getDocPresignUrl(body: PresignedUploadDocBodyType) {
    const randomFilename = generateRandomFilename(body.filename)
    const presignedUrl = await this.s3Service.createPresignedUrlWithClient('docs/' + randomFilename, 60)
    const url = presignedUrl.split('?')[0]
    return {
      presignedUrl,
      url
    }
  }
}
