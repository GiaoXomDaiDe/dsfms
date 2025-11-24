import z from 'zod'
import { PermissionGroupCollectionItemSchema } from '~/routes/permission-group/permission-group.model'
import { PermissionSchema } from '~/routes/permission/permission.model'
import {
  AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE,
  PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE
} from '~/routes/role/role.error'
import { ROLE_NAME_REGEX, optionalAlphabeticCharacter, requiredText } from '~/shared/constants/validation.constant'

export const RoleSchema = z.object({
  id: z.uuid(),
  name: requiredText('Role name', 500, {
    pattern: ROLE_NAME_REGEX,
    message: 'Role name must contain only alphabetic characters and spaces'
  }),
  description: z.string().trim().max(500).nullable().refine(optionalAlphabeticCharacter, {
    message: 'Description must include at least one alphabetic character'
  }),
  isActive: z.boolean().default(true),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .nullable(),
  createdAt: z.iso.datetime().transform((value) => new Date(value)),
  updatedAt: z.iso.datetime().transform((value) => new Date(value))
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

export const RoleWithPermissionsSchema = RoleSchema.extend({
  // permissions: z.array(PermissionSchema),
  userCount: z.number().default(0),
  permissionCount: z.number().default(0)
})

export const RolePermissionGroupSchema = z.object({
  featureGroup: z.string(),
  permissionCount: z.number().int().nonnegative(),
  permissions: PermissionGroupCollectionItemSchema.array()
})

export const GetRoleDetailResSchema = RoleWithPermissionsSchema.extend({
  permissionGroups: z.array(RolePermissionGroupSchema)
})

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

export const CreateRoleResSchema = RoleWithPermissionsSchema

export const UpdateRoleBodySchema = CreateRoleBodySchema.partial()

export const UpdateRoleResSchema = RoleWithPermissionsSchema

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

export type RoleType = z.infer<typeof RoleSchema>
export type RoleWithPermissionsType = z.infer<typeof RoleWithPermissionsSchema>
export type GetRolesResType = z.infer<typeof GetRolesResSchema>
export type GetRoleDetailResType = z.infer<typeof GetRoleDetailResSchema>
export type CreateRoleResType = z.infer<typeof CreateRoleResSchema>
export type CreateRoleBodyType = z.infer<typeof CreateRoleBodySchema>
export type GetRoleParamsType = z.infer<typeof GetRoleParamsSchema>
export type UpdateRoleBodyType = z.infer<typeof UpdateRoleBodySchema>
export type RoleWithUserCountType = z.infer<typeof RoleWithUserCountSchema>
export type AddPermissionsToRoleBodyType = z.infer<typeof AddPermissionsToRoleBodySchema>
export type AddPermissionsToRoleResType = z.infer<typeof AddPermissionsToRoleResSchema>
export type RemovePermissionsFromRoleBodyType = z.infer<typeof RemovePermissionsFromRoleBodySchema>
export type RemovePermissionsFromRoleResType = z.infer<typeof RemovePermissionsFromRoleResSchema>
