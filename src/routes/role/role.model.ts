import z from 'zod'
import { PermissionSchema } from '~/routes/permission/permission.model'

export const RoleSchema = z.object({
  id: z.uuid(),
  name: z.string().max(500),
  description: z.string().nullable(),
  isActive: z.boolean().default(true),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})
export const RolePermissionsSchema = RoleSchema.extend({
  permissions: z.array(PermissionSchema)
})

export type RoleType = z.infer<typeof RoleSchema>
export type RolePermissionsType = z.infer<typeof RolePermissionsSchema>
