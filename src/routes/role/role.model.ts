import z from 'zod'
import {
  AT_LEAST_ONE_PERMISSION_GROUP_REQUIRED_MESSAGE,
  AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE,
  PERMISSION_GROUP_CODES_MUST_BE_UNIQUE_MESSAGE,
  PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE
} from '~/routes/role/role.error'
import { PermissionGroupCollectionItemSchema } from '~/shared/models/shared-permission-group.model'
import { PermissionSchema } from '~/shared/models/shared-permission.model'
import { RoleSchema, type RoleType as SharedRoleType } from '~/shared/models/shared-role.model'

/* =========================
 * Base schemas
 * =======================*/

export const RoleWithUserCountSchema = RoleSchema.extend({
  userCount: z.number()
})

export const RoleWithPermissionsSchema = RoleSchema.extend({
  userCount: z.number().default(0),
  permissionCount: z.number().default(0)
})

export const RolePermissionGroupSchema = z.object({
  featureGroup: z.string(),
  permissions: PermissionGroupCollectionItemSchema.array()
})

/* =========================
 * List / Detail schemas
 * =======================*/

export const GetRolesResSchema = z.object({
  roles: z.array(RoleWithUserCountSchema),
  totalItems: z.number()
})

export const GetRoleParamsSchema = z
  .object({
    roleId: z.uuid()
  })
  .strict()

export const GetRoleDetailResSchema = RoleWithPermissionsSchema.extend({
  permissionGroups: z.array(RolePermissionGroupSchema)
})

/* =========================
 * Create / Update schemas
 * =======================*/

export const CreateRoleBodySchema = RoleSchema.pick({
  name: true,
  description: true
})
  .extend({
    permissionGroupCodes: z
      .array(z.string().min(1))
      .min(1, AT_LEAST_ONE_PERMISSION_GROUP_REQUIRED_MESSAGE)
      .refine((codes) => new Set(codes).size === codes.length, PERMISSION_GROUP_CODES_MUST_BE_UNIQUE_MESSAGE)
  })
  .strict()

export const CreateRoleResSchema = RoleWithPermissionsSchema

export const UpdateRoleBodySchema = CreateRoleBodySchema.partial()

export const UpdateRoleResSchema = RoleWithPermissionsSchema

/* =========================
 * Add / Remove permissions
 * =======================*/

export const AddPermissionsToRoleBodySchema = z
  .object({
    permissionIds: z
      .array(z.uuid())
      .min(1, AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE)
      .refine((ids) => new Set(ids).size === ids.length, PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE)
  })
  .strict()

export const AddPermissionsToRoleResSchema = z.object({
  addedPermissions: z.array(PermissionSchema),
  addedCount: z.number().int().positive(),
  summary: z.string()
})

export const RemovePermissionsFromRoleBodySchema = AddPermissionsToRoleBodySchema

export const RemovePermissionsFromRoleResSchema = z.object({
  removedPermissions: z.array(PermissionSchema),
  removedCount: z.number().int().nonnegative(),
  summary: z.string()
})

export type RoleType = SharedRoleType
export type RoleWithPermissionsType = z.infer<typeof RoleWithPermissionsSchema>
export type RoleWithUserCountType = z.infer<typeof RoleWithUserCountSchema>

export type GetRolesResType = z.infer<typeof GetRolesResSchema>
export type GetRoleDetailResType = z.infer<typeof GetRoleDetailResSchema>
export type GetRoleParamsType = z.infer<typeof GetRoleParamsSchema>

export type CreateRoleBodyType = z.infer<typeof CreateRoleBodySchema>
export type CreateRoleResType = z.infer<typeof CreateRoleResSchema>
export type UpdateRoleBodyType = z.infer<typeof UpdateRoleBodySchema>
export type UpdateRoleResType = z.infer<typeof UpdateRoleResSchema>

export type AddPermissionsToRoleBodyType = z.infer<typeof AddPermissionsToRoleBodySchema>
export type AddPermissionsToRoleResType = z.infer<typeof AddPermissionsToRoleResSchema>
export type RemovePermissionsFromRoleBodyType = z.infer<typeof RemovePermissionsFromRoleBodySchema>
export type RemovePermissionsFromRoleResType = z.infer<typeof RemovePermissionsFromRoleResSchema>
