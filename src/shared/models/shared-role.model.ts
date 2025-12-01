import z from 'zod'
import { isoDatetimeSchema, nullableUuidSchema } from '~/shared/helpers/zod-validation.helper'
import { roleDescriptionSchema, roleNameSchema } from '~/shared/validation/role.validation'

export const RoleSchema = z.object({
  id: z.uuid(),
  name: roleNameSchema,
  description: roleDescriptionSchema,
  isActive: z.boolean().default(true),
  createdById: nullableUuidSchema,
  updatedById: nullableUuidSchema,
  deletedById: nullableUuidSchema,
  deletedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema
})

export const roleIdNameSchema = RoleSchema.pick({ id: true, name: true })
export const roleSummarySchema = RoleSchema.pick({ id: true, name: true, description: true, isActive: true })

export type RoleType = z.infer<typeof RoleSchema>
export type RoleIdNameType = z.infer<typeof roleIdNameSchema>
export type RoleSummaryType = z.infer<typeof roleSummarySchema>
