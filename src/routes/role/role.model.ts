import z from 'zod'
import { PermissionSchema } from '~/routes/permission/permission.model'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'

export const RoleSchema = z.object({
  id: z.uuid(),
  name: z.string().max(500),
  description: z.string().nullable(),
  isActive: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const GetRolesQuerySchema = IncludeDeletedQuerySchema.strict()

export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(PermissionSchema),
  userCount: z.number().default(0),
  permissionCount: z.number().default(0)
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

export const GetRoleDetailResSchema = RoleWithPermissionsSchema

export const CreateRoleBodySchema = RoleSchema.pick({
  name: true,
  description: true
})
  .extend({
    permissionIds: z
      .array(z.uuid())
      .min(1, 'At least one permission is required')
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Duplicate permission IDs are not allowed'
      })
  })
  .strict()

export const CreateRoleResSchema = RoleSchema

export const UpdateRoleBodySchema = RoleSchema.pick({
  name: true,
  description: true
})
  .extend({
    permissionIds: z
      .array(z.uuid())
      .min(1, 'At least one permission is required')
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Duplicate permission IDs are not allowed'
      })
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
