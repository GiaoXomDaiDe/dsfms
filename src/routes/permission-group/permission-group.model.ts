import z from 'zod'

export const PermissionGroupSchema = z.object({
  id: z.string(),
  groupName: z.string(),
  name: z.string(),
  permissionGroupCode: z.string()
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

const PermissionGroupResponseWrapper = z.object({
  message: z.string(),
  data: PermissionGroupSchema
})
export const PermissionGroupResSchema = PermissionGroupResponseWrapper

export const PermissionGroupCollectionItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string()
})

export const PermissionGroupCollectionSchema = z.object({
  groupName: z.string(),
  permissionsGroup: PermissionGroupCollectionItemSchema.array()
})

export const PermissionGroupListResSchema = z.object({
  message: z.string(),
  data: PermissionGroupCollectionSchema.array()
})

export const AssignPermissionGroupPermissionsBodySchema = z.object({
  permissionIds: z.array(z.string()).default([])
})
export const AssignPermissionGroupPermissionsResSchema = PermissionGroupResponseWrapper

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>
export type CreatePermissionGroupBodyType = z.infer<typeof CreatePermissionGroupBodySchema>
export type UpdatePermissionGroupBodyType = z.infer<typeof UpdatePermissionGroupBodySchema>
export type PermissionGroupParamsType = z.infer<typeof PermissionGroupParamsSchema>
export type PermissionGroupResType = z.infer<typeof PermissionGroupResSchema>
export type PermissionGroupCollectionType = z.infer<typeof PermissionGroupCollectionSchema>
export type PermissionGroupCollectionItemType = z.infer<typeof PermissionGroupCollectionItemSchema>
export type PermissionGroupListResType = z.infer<typeof PermissionGroupListResSchema>
export type AssignPermissionGroupPermissionsBodyType = z.infer<typeof AssignPermissionGroupPermissionsBodySchema>
export type AssignPermissionGroupPermissionsResType = z.infer<typeof AssignPermissionGroupPermissionsResSchema>
