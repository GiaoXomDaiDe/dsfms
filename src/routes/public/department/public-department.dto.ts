import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Public Department Schema - chỉ thông tin cơ bản, an toàn
export const PublicDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean().default(true)
})

// Response schemas
export const GetPublicDepartmentsResSchema = z.object({
  data: z.array(PublicDepartmentSchema),
  totalItems: z.number()
})

// DTO classes
export class PublicDepartmentDTO extends createZodDto(PublicDepartmentSchema) {}
export class GetPublicDepartmentsResDTO extends createZodDto(GetPublicDepartmentsResSchema) {}

// Types
export type PublicDepartmentType = z.infer<typeof PublicDepartmentSchema>
export type GetPublicDepartmentsResType = z.infer<typeof GetPublicDepartmentsResSchema>
