import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, NotFoundException } from '@nestjs/common'
import { readFileSync } from 'fs'
import mime from 'mime-types'
import type { Readable } from 'stream'
import envConfig from '~/shared/config'

@Injectable()
export class S3Service {
  private s3: S3
  constructor() {
    this.s3 = new S3({
      region: envConfig.AWS_S3_REGION,
      credentials: {
        secretAccessKey: envConfig.AWS_S3_SECRET_KEY,
        accessKeyId: envConfig.AWS_S3_ACCESS_KEY
      }
    })
  }

  uploadedFile({ filename, filepath, contentType }: { filename: string; filepath: string; contentType: string }) {
    const parallelUploads3 = new Upload({
      client: this.s3,
      params: {
        Bucket: envConfig.AWS_S3_BUCKET_NAME,
        Key: filename,
        Body: readFileSync(filepath),
        ContentType: contentType
      },
      tags: [],
      queueSize: 4,
      partSize: 1024 * 1024 * 5,
      leavePartsOnError: false
    })
    return parallelUploads3.done()
  }

  createPresignedUrlWithClient(filename: string, expiresIn: number = 30) {
    const contentType = mime.lookup(filename) || 'application/octet-stream'
    const command = new PutObjectCommand({
      Bucket: envConfig.AWS_S3_BUCKET_NAME,
      Key: filename,
      ContentType: contentType
    })
    return getSignedUrl(this.s3, command, { expiresIn })
  }

  getObjectUrl(key: string) {
    return `https://${envConfig.AWS_S3_BUCKET_NAME}.s3.${envConfig.AWS_S3_REGION}.amazonaws.com/${key}`
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: envConfig.AWS_S3_BUCKET_NAME,
          Key: key
        })
      )
    } catch (error: any) {
      const statusCode = error?.$metadata?.httpStatusCode
      const errorName = error?.name
      if (statusCode === 404 || errorName === 'NotFound' || errorName === 'NoSuchKey') {
        throw new NotFoundException('Object not found on S3')
      }
      throw error
    }

    const command = new DeleteObjectCommand({
      Bucket: envConfig.AWS_S3_BUCKET_NAME,
      Key: key
    })
    await this.s3.send(command)
  }

  async uploadStream({ key, body, contentType }: { key: string; body: Readable; contentType?: string }) {
    const uploader = new Upload({
      client: this.s3,
      params: {
        Bucket: envConfig.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType ?? 'application/octet-stream'
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 5,
      leavePartsOnError: false
    })

    const result = (await uploader.done()) as { Key?: string; Location?: string }
    const resolvedKey = result?.Key ?? key
    const location = result?.Location ?? this.getObjectUrl(resolvedKey)

    return {
      key: resolvedKey,
      url: location
    }
  }

  async uploadBuffer({ key, body, contentType }: { key: string; body: Buffer; contentType?: string }) {
    const uploader = new Upload({
      client: this.s3,
      params: {
        Bucket: envConfig.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType ?? 'application/octet-stream'
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 5,
      leavePartsOnError: false
    })

    const result = (await uploader.done()) as { Key?: string; Location?: string }
    const resolvedKey = result?.Key ?? key
    const location = result?.Location ?? this.getObjectUrl(resolvedKey)

    return {
      key: resolvedKey,
      url: location
    }
  }

  async getObject(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: envConfig.AWS_S3_BUCKET_NAME,
        Key: key
      })
      
      const response = await this.s3.send(command)
      
      if (!response.Body) {
        throw new NotFoundException('Object body not found')
      }
      
      return response.Body as Readable
    } catch (error: any) {
      const statusCode = error?.$metadata?.httpStatusCode
      const errorName = error?.name
      if (statusCode === 404 || errorName === 'NotFound' || errorName === 'NoSuchKey') {
        throw new NotFoundException('Object not found on S3')
      }
      throw error
    }
  }
}
