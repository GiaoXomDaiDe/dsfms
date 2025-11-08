import z from 'zod'
import { PermissionSchema } from '~/routes/permission/permission.model'
import {
  AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE,
  PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE
} from '~/routes/role/role.error'

export const RoleSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, 'Role name is required')
    .max(500)
    .regex(/^[A-Za-z\s]+$/, 'Role name must contain only alphabetic characters and spaces'),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine((value) => value === null || value === '' || /[A-Za-z]/.test(value), {
      message: 'Description must include at least one alphabetic character'
    }),
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

export const CreateRoleResSchema = GetRoleDetailResSchema

export const UpdateRoleBodySchema = CreateRoleBodySchema.partial()

export const UpdateRoleResSchema = GetRoleDetailResSchema

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
