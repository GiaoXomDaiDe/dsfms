import { createZodDto } from 'nestjs-zod'
import {
  PresignedUploadDocBodySchema,
  PresignedUploadFileBodySchema,
  PresignedUploadFileResSchema,
  DeleteMediaObjectBodySchema,
  UploadFilesResSchema
} from 'src/routes/media/media.model'

export class PresignedUploadFileBodyDTO extends createZodDto(PresignedUploadFileBodySchema) {}

export class PresignedUploadDocBodyDTO extends createZodDto(PresignedUploadDocBodySchema) {}

export class UploadFilesResDTO extends createZodDto(UploadFilesResSchema) {}

export class PresignedUploadFileResDTO extends createZodDto(PresignedUploadFileResSchema) {}

export class DeleteMediaObjectBodyDTO extends createZodDto(DeleteMediaObjectBodySchema) {}
