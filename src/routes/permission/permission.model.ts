import z from 'zod'
import { PermissionSchema, type PermissionType as SharedPermissionType } from '~/shared/models/shared-permission.model'

export { PermissionSchema } from '~/shared/models/shared-permission.model'

export const PermissionListItemSchema = PermissionSchema.pick({
  id: true,
  name: true
})

export const PermissionModuleSchema = z.object({
  module: z.object({
    name: z.string().min(1),
    listPermissions: z.array(PermissionListItemSchema)
  })
})

export const GetPermissionsResSchema = z.object({
  modules: z.array(PermissionModuleSchema),
  totalItems: z.number()
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
export type PermissionModuleType = z.infer<typeof PermissionModuleSchema>
export type PermissionListItemType = z.infer<typeof PermissionListItemSchema>
export type GetPermissionParamsType = z.infer<typeof GetPermissionParamsSchema>
export type GetPermissionDetailResType = z.infer<typeof GetPermissionDetailResSchema>
export type CreatePermissionBodyType = z.infer<typeof CreatePermissionBodySchema>
export type UpdatePermissionBodyType = z.infer<typeof UpdatePermissionBodySchema>
