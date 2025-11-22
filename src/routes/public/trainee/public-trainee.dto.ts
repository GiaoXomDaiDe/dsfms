import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const PublicTraineeSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  departmentId: z.string().uuid().nullable(),
  departmentName: z.string().nullable(),
  avatarUrl: z.string().nullable()
})

export const GetPublicTraineesResSchema = z.object({
  data: z.array(PublicTraineeSchema),
  totalItems: z.number()
})

export class PublicTraineeDTO extends createZodDto(PublicTraineeSchema) {}
export class GetPublicTraineesResDTO extends createZodDto(GetPublicTraineesResSchema) {}

export type PublicTraineeType = z.infer<typeof PublicTraineeSchema>
export type GetPublicTraineesResType = z.infer<typeof GetPublicTraineesResSchema>
