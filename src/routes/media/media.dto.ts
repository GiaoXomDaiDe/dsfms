import { createZodDto } from 'nestjs-zod'
import {
  DeleteMediaObjectBodySchema,
  OnlyOfficeCallbackBodySchema,
  OnlyOfficeCallbackResSchema,
  OnlyOfficeDocumentResultSchema,
  OnlyOfficeForceSaveBodySchema,
  OnlyOfficeForceSaveResSchema,
  OnlyOfficeSubmitBodySchema,
  OnlyOfficeSubmitResSchema,
  PresignedUploadDocBodySchema,
  PresignedUploadFileBodySchema,
  PresignedUploadFileResSchema,
  UploadDocFromUrlBodySchema,
  UploadFilesResSchema
} from 'src/routes/media/media.model'

export class PresignedUploadFileBodyDTO extends createZodDto(PresignedUploadFileBodySchema) {}

export class PresignedUploadDocBodyDTO extends createZodDto(PresignedUploadDocBodySchema) {}

export class UploadFilesResDTO extends createZodDto(UploadFilesResSchema) {}

export class PresignedUploadFileResDTO extends createZodDto(PresignedUploadFileResSchema) {}

export class DeleteMediaObjectBodyDTO extends createZodDto(DeleteMediaObjectBodySchema) {}

export class UploadDocFromUrlBodyDTO extends createZodDto(UploadDocFromUrlBodySchema) {}

export class UploadDocFromUrlResDTO extends createZodDto(UploadFilesResSchema) {}

export class OnlyOfficeCallbackBodyDTO extends createZodDto(OnlyOfficeCallbackBodySchema) {}

export class OnlyOfficeCallbackResDTO extends createZodDto(OnlyOfficeCallbackResSchema) {}

export class OnlyOfficeDocumentResultDTO extends createZodDto(OnlyOfficeDocumentResultSchema) {}

export class OnlyOfficeForceSaveBodyDTO extends createZodDto(OnlyOfficeForceSaveBodySchema) {}

export class OnlyOfficeForceSaveResDTO extends createZodDto(OnlyOfficeForceSaveResSchema) {}

export class OnlyOfficeSubmitBodyDTO extends createZodDto(OnlyOfficeSubmitBodySchema) {}

export class OnlyOfficeSubmitResDTO extends createZodDto(OnlyOfficeSubmitResSchema) {}
