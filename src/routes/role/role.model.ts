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
export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(PermissionSchema),
  userCount: z.number(),
  permissionCount: z.number()
})
export const RoleWithUserCountSchema = RoleSchema.extend({
  userCount: z.number()
})
export const GetRolesResSchema = z.object({
  roles: z.array(RoleWithUserCountSchema),
  totalItems: z.number()
})

export const GetRoleParamsSchema = z
  .object({
    roleId: z.uuid()
  })
  .strict()

export const GetRolesQuerySchema = z
  .object({
    includeDeleted: z.coerce.boolean().default(false).optional()
  })
  .strict()

export const GetRoleDetailResSchema = RoleWithPermissionsSchema

export const CreateRoleBodySchema = RoleSchema.pick({
  name: true,
  description: true,
  isActive: true
}).strict()

export const CreateRoleResSchema = RoleSchema

export const UpdateRoleBodySchema = RoleSchema.pick({
  name: true,
  description: true,
  isActive: true
})
  .extend({
    permissionIds: z.array(z.uuid())
  })
  .strict()

export type RoleType = z.infer<typeof RoleSchema>
export type RoleWithPermissionsType = z.infer<typeof RoleWithPermissionsSchema>
export type GetRolesResType = z.infer<typeof GetRolesResSchema>
export type GetRoleDetailResType = z.infer<typeof GetRoleDetailResSchema>
export type CreateRoleResType = z.infer<typeof CreateRoleResSchema>
export type CreateRoleBodyType = z.infer<typeof CreateRoleBodySchema>
export type GetRoleParamsType = z.infer<typeof GetRoleParamsSchema>
export type GetRolesQueryType = z.infer<typeof GetRolesQuerySchema>
export type UpdateRoleBodyType = z.infer<typeof UpdateRoleBodySchema>
export type RoleWithUserCountType = z.infer<typeof RoleWithUserCountSchema>
