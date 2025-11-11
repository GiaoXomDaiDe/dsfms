import { z } from 'zod'

export const PresignedUploadFileBodySchema = z
  .object({
    extension: z.string().regex(/^\.(jpg|jpeg|png|webp)$/i, 'Invalid image extension'),
    filesize: z
      .number()
      .max(5 * 1024 * 1024)
      .optional(),
    type: z.string().min(1).optional()
  })
  .strict()

export const PresignedUploadDocBodySchema = z
  .object({
    extension: z.string().regex(/^\.(pdf|docx|doc|txt)$/i, 'Invalid document extension'),
    filesize: z
      .number()
      .max(10 * 1024 * 1024)
      .optional(),
    type: z.string().min(1).optional()
  })
  .strict()

export const UploadFilesResSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      url: z.string()
    })
  )
})

export const PresignedUploadFileResSchema = z.object({
  presignedUrl: z.string(),
  url: z.string(),
  id: z.string()
})

export const DeleteMediaObjectBodySchema = z
  .object({
    key: z.string().min(1)
  })
  .strict()

export const UploadDocFromUrlBodySchema = z.object({
  sourceUrl: z.url(),
  fileName: z.string().min(1)
})

export const UploadDocFromUrlResSchema = UploadFilesResSchema

export const OnlyOfficeSubmitBodySchema = z
  .object({
    downloadUrl: z.url(),
    fileName: z.string().min(1),
    templateId: z.string().min(1).optional(),
    documentKey: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict()

export const OnlyOfficeSubmitResSchema = UploadFilesResSchema.extend({
  templateId: z.string().optional(),
  documentKey: z.string().optional()
})

export const OnlyOfficeCallbackActionSchema = z
  .object({
    type: z.number(),
    userid: z.string()
  })
  .strict()

const OnlyOfficeCallbackStatusSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(6),
  z.literal(7)
])

export const OnlyOfficeCallbackBodySchema = z.object({
  status: OnlyOfficeCallbackStatusSchema,
  history: z.any().optional(),
  changesurl: z.url().optional(),
  key: z.string(),
  url: z.url().optional(),
  filetype: z.string().optional().default('OOXML'),
  actions: z.array(OnlyOfficeCallbackActionSchema).optional(),
  users: z.array(z.string()).optional(),
  userdata: z.string().optional(),
  forcesavetype: z.number().optional(),
  formsdataurl: z.url().optional()
})

export const OnlyOfficeCallbackResSchema = z.object({
  error: z.number().int()
})

export const OnlyOfficeDocumentResultSchema = z.object({
  key: z.string(),
  url: z.url(),
  savedAt: z.string()
})

export const OnlyOfficeForceSaveBodySchema = z
  .object({
    key: z.string().min(1),
    userdata: z.string().optional()
  })
  .strict()

export const OnlyOfficeForceSaveResSchema = z.object({
  error: z.union([z.literal(0), z.literal(4)]),
  message: z.string()
})

export type PresignedUploadFileBodyType = z.infer<typeof PresignedUploadFileBodySchema>
export type PresignedUploadDocBodyType = z.infer<typeof PresignedUploadDocBodySchema>
export type DeleteMediaObjectBodyType = z.infer<typeof DeleteMediaObjectBodySchema>
export type UploadDocFromUrlBodyType = z.infer<typeof UploadDocFromUrlBodySchema>
export type UploadDocFromUrlResType = z.infer<typeof UploadDocFromUrlResSchema>
export type OnlyOfficeSubmitBodyType = z.infer<typeof OnlyOfficeSubmitBodySchema>
export type OnlyOfficeSubmitResType = z.infer<typeof OnlyOfficeSubmitResSchema>
export type OnlyOfficeCallbackBodyType = z.infer<typeof OnlyOfficeCallbackBodySchema>
export type OnlyOfficeCallbackResType = z.infer<typeof OnlyOfficeCallbackResSchema>
export type OnlyOfficeDocumentResultType = z.infer<typeof OnlyOfficeDocumentResultSchema>
export type OnlyOfficeForceSaveBodyType = z.infer<typeof OnlyOfficeForceSaveBodySchema>
export type OnlyOfficeForceSaveResType = z.infer<typeof OnlyOfficeForceSaveResSchema>
