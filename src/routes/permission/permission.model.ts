import z from 'zod'
import { PermissionSchema, type PermissionType as SharedPermissionType } from '~/shared/models/shared-permission.model'

export const GetPermissionsResSchema = z.object({
  permissions: z.array(PermissionSchema),
  totalItems: z.number().int()
})

export const GetPermissionParamsSchema = z
  .object({
    permissionId: z.uuid()
  })
  .strict()

export const GetPermissionDetailResSchema = PermissionSchema

export const CreatePermissionBodySchema = PermissionSchema.pick({
  name: true,
  path: true,
  method: true,
  module: true,
  description: true,
  isActive: true,
  viewName: true,
  viewModule: true
}).strict()

export const UpdatePermissionBodySchema = CreatePermissionBodySchema.partial()

export type PermissionType = SharedPermissionType
export type GetPermissionsResType = z.infer<typeof GetPermissionsResSchema>
export type GetPermissionParamsType = z.infer<typeof GetPermissionParamsSchema>
export type GetPermissionDetailResType = z.infer<typeof GetPermissionDetailResSchema>
export type CreatePermissionBodyType = z.infer<typeof CreatePermissionBodySchema>
export type UpdatePermissionBodyType = z.infer<typeof UpdatePermissionBodySchema>
