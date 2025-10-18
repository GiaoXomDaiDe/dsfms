import z from 'zod'
import { PermissionSchema } from '~/routes/permission/permission.model'
import {
  AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE,
  PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE
} from '~/routes/role/role.error'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'

export const RoleSchema = z.object({
  id: z.uuid(),
  name: z.string().max(500),
  description: z.string().nullable(),
  isActive: z.boolean().default(true),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d))
})

export const GetRolesQuerySchema = IncludeDeletedQuerySchema.strict()

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

export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(PermissionSchema),
  userCount: z.number().default(0),
  permissionCount: z.number().default(0)
})

export const GetRoleDetailResSchema = RoleWithPermissionsSchema

export const CreateRoleBodySchema = RoleSchema.pick({
  name: true,
  description: true
})
  .extend({
    permissionIds: z
      .array(z.uuid())
      .min(1, AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE)
      .refine((ids) => new Set(ids).size === ids.length, PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE)
  })
  .strict()

export const CreateRoleResSchema = RoleSchema

export const UpdateRoleBodySchema = CreateRoleBodySchema.partial()

export const UpdateRoleResSchema = CreateRoleResSchema

export const AddPermissionsToRoleBodySchema = z
  .object({
    permissionIds: z
      .array(z.uuid())
      .min(1, AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE)
      .refine((ids) => new Set(ids).size === ids.length, PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE)
  })
  .strict()

export const AddPermissionsToRoleResSchema = z.object({
  message: z.string(),
  addedPermissions: z.array(PermissionSchema)
})

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
export type AddPermissionsToRoleBodyType = z.infer<typeof AddPermissionsToRoleBodySchema>
export type AddPermissionsToRoleResType = z.infer<typeof AddPermissionsToRoleResSchema>
