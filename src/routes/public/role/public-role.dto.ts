import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Public Role Schema - chỉ thông tin cơ bản cho dropdown, select box
export const PublicRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean().default(true)
})

// Response schemas
export const GetPublicRolesResSchema = z.object({
  data: z.array(PublicRoleSchema),
  totalItems: z.number()
})

// DTO classes
export class PublicRoleDTO extends createZodDto(PublicRoleSchema) {}
export class GetPublicRolesResDTO extends createZodDto(GetPublicRolesResSchema) {}

// Types
export type PublicRoleType = z.infer<typeof PublicRoleSchema>
export type GetPublicRolesResType = z.infer<typeof GetPublicRolesResSchema>
