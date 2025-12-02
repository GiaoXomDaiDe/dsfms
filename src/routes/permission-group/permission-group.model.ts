import z from 'zod'
import {
  PermissionGroupCollectionSchema,
  PermissionGroupPermissionSchema,
  PermissionGroupSchema,
  type PermissionGroupCollectionItemType as SharedPermissionGroupCollectionItemType,
  type PermissionGroupCollectionType as SharedPermissionGroupCollectionType,
  type PermissionGroupPermissionType as SharedPermissionGroupPermissionType,
  type PermissionGroupType as SharedPermissionGroupType
} from '~/shared/models/shared-permission-group.model'

export {
  PermissionGroupCollectionItemSchema,
  PermissionGroupCollectionSchema,
  PermissionGroupPermissionSchema,
  PermissionGroupSchema
} from '~/shared/models/shared-permission-group.model'

export const PermissionGroupDetailSchema = PermissionGroupSchema.extend({
  permissionCount: z.number().int(),
  permissions: PermissionGroupPermissionSchema.array()
})

export const CreatePermissionGroupBodySchema = PermissionGroupSchema.pick({
  groupName: true,
  name: true,
  permissionGroupCode: true
})

export const UpdatePermissionGroupBodySchema = CreatePermissionGroupBodySchema.partial()

export const PermissionGroupParamsSchema = z.object({
  permissionGroupId: z.string()
})

const PermissionGroupResponseWrapperSchema = z.object({
  message: z.string(),
  data: PermissionGroupSchema
})

export const PermissionGroupResSchema = PermissionGroupResponseWrapperSchema

export const PermissionGroupDetailResSchema = z.object({
  message: z.string(),
  data: PermissionGroupDetailSchema
})

export const PermissionGroupListResSchema = z.object({
  message: z.string(),
  data: PermissionGroupCollectionSchema.array()
})

export const AssignPermissionGroupPermissionsBodySchema = z.object({
  permissionIds: z.array(z.string()).default([])
})

export const AssignPermissionGroupPermissionsResSchema = PermissionGroupDetailResSchema

export type PermissionGroupType = SharedPermissionGroupType
export type PermissionGroupPermissionType = SharedPermissionGroupPermissionType
export type PermissionGroupDetailType = z.infer<typeof PermissionGroupDetailSchema>

export type CreatePermissionGroupBodyType = z.infer<typeof CreatePermissionGroupBodySchema>
export type UpdatePermissionGroupBodyType = z.infer<typeof UpdatePermissionGroupBodySchema>
export type PermissionGroupParamsType = z.infer<typeof PermissionGroupParamsSchema>

export type PermissionGroupResType = z.infer<typeof PermissionGroupResSchema>
export type PermissionGroupDetailResType = z.infer<typeof PermissionGroupDetailResSchema>

export type PermissionGroupCollectionType = SharedPermissionGroupCollectionType
export type PermissionGroupCollectionItemType = SharedPermissionGroupCollectionItemType
export type PermissionGroupListResType = z.infer<typeof PermissionGroupListResSchema>

export type AssignPermissionGroupPermissionsBodyType = z.infer<typeof AssignPermissionGroupPermissionsBodySchema>
export type AssignPermissionGroupPermissionsResType = z.infer<typeof AssignPermissionGroupPermissionsResSchema>
