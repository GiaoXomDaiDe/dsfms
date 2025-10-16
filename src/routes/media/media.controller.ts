import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { ZodSerializerDto } from 'nestjs-zod'
import path from 'path'
import {
  PresignedUploadDocBodyDTO,
  PresignedUploadFileBodyDTO,
  PresignedUploadFileResDTO,
  UploadFilesResDTO
} from '~/routes/media/media.dto'
import { MediaService } from '~/routes/media/media.service'
import { ParseFilePipeWithUnlink } from '~/routes/media/parse-file-with-unlink.pipe'
import { UPLOAD_DIR } from '~/shared/constants/default.constant'
import { IsPublic } from '~/shared/decorators/auth.decorator'

@Controller('media')
@IsPublic()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('images/upload')
  @ZodSerializerDto(UploadFilesResDTO)
  @UseInterceptors(
    FilesInterceptor('files', 100, {
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      }
    })
  )
  uploadFile(
    @UploadedFiles(
      new ParseFilePipeWithUnlink({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/, skipMagicNumbersValidation: true })
        ]
      })
    )
    files: Express.Multer.File[]
  ) {
    return this.mediaService.uploadFile(files)
  }

  @Get('static/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    return res.sendFile(path.resolve(UPLOAD_DIR, filename), (error) => {
      if (error) {
        const notfound = new NotFoundException('File not found')
        res.status(notfound.getStatus()).json(notfound.getResponse())
      }
    })
  }

  @Post('images/upload/presigned-url')
  @ZodSerializerDto(PresignedUploadFileResDTO)
  async createPresignedUrl(@Body() body: PresignedUploadFileBodyDTO) {
    return this.mediaService.getPresignUrl(body)
  }

  @Post('docs/upload')
  @ZodSerializerDto(UploadFilesResDTO)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB per file
      }
    })
  )
  uploadDocFile(
    @UploadedFiles(
      new ParseFilePipeWithUnlink({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType:
              /(application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword|application\/pdf|text\/plain)$/,
            skipMagicNumbersValidation: true
          })
        ]
      })
    )
    files: Express.Multer.File[]
  ) {
    return this.mediaService.uploadDocFile(files)
  }

  @Post('docs/upload/presigned-url')
  @ZodSerializerDto(PresignedUploadFileResDTO)
  createDocPresignedUrl(@Body() body: PresignedUploadDocBodyDTO) {
    return this.mediaService.getDocPresignUrl(body)
  }
}
