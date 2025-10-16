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
      url: z.string()
    })
  )
})

export const PresignedUploadFileResSchema = z.object({
  presignedUrl: z.string(),
  url: z.string()
})

export type PresignedUploadFileBodyType = z.infer<typeof PresignedUploadFileBodySchema>
export type PresignedUploadDocBodyType = z.infer<typeof PresignedUploadDocBodySchema>
