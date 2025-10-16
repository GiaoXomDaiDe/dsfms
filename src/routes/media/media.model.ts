import { z } from 'zod'

export const PresignedUploadFileBodySchema = z
  .object({
    filename: z.string(),
    filesize: z.number().max(10 * 1024 * 1024) // 10MB để support cả docs và images
  })
  .strict()

export const PresignedUploadDocBodySchema = z
  .object({
    filename: z.string(),
    filesize: z.number().max(10 * 1024 * 1024) // 10MB cho documents
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
