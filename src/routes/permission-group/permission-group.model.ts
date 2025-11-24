import { HttpMethod } from '@prisma/client'
import z from 'zod'

export const PermissionGroupSchema = z.object({
  id: z.string(),
  groupName: z.string(),
  name: z.string(),
  permissionGroupCode: z.string()
})

export const PermissionGroupPermissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: z.nativeEnum(HttpMethod),
  path: z.string(),
  module: z.string(),
  description: z.string().nullable(),
  viewModule: z.string().nullable(),
  viewName: z.string().nullable()
})

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

const PermissionGroupResponseWrapper = z.object({
  message: z.string(),
  data: PermissionGroupSchema
})
export const PermissionGroupResSchema = PermissionGroupResponseWrapper

export const PermissionGroupDetailResSchema = z.object({
  message: z.string(),
  data: PermissionGroupDetailSchema
})

export const PermissionGroupCollectionItemSchema = z.object({
  code: z.string(),
  name: z.string()
})

export const PermissionGroupCollectionSchema = z.object({
  featureGroup: z.string(),
  permissions: PermissionGroupCollectionItemSchema.array()
})

export const PermissionGroupListResSchema = z.object({
  message: z.string(),
  data: PermissionGroupCollectionSchema.array()
})

export const AssignPermissionGroupPermissionsBodySchema = z.object({
  permissionIds: z.array(z.string()).default([])
})
export const AssignPermissionGroupPermissionsResSchema = PermissionGroupDetailResSchema

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>
export type PermissionGroupPermissionType = z.infer<typeof PermissionGroupPermissionSchema>
export type PermissionGroupDetailType = z.infer<typeof PermissionGroupDetailSchema>
export type CreatePermissionGroupBodyType = z.infer<typeof CreatePermissionGroupBodySchema>
export type UpdatePermissionGroupBodyType = z.infer<typeof UpdatePermissionGroupBodySchema>
export type PermissionGroupParamsType = z.infer<typeof PermissionGroupParamsSchema>
export type PermissionGroupResType = z.infer<typeof PermissionGroupResSchema>
export type PermissionGroupDetailResType = z.infer<typeof PermissionGroupDetailResSchema>
export type PermissionGroupCollectionType = z.infer<typeof PermissionGroupCollectionSchema>
export type PermissionGroupCollectionItemType = z.infer<typeof PermissionGroupCollectionItemSchema>
export type PermissionGroupListResType = z.infer<typeof PermissionGroupListResSchema>
export type AssignPermissionGroupPermissionsBodyType = z.infer<typeof AssignPermissionGroupPermissionsBodySchema>
export type AssignPermissionGroupPermissionsResType = z.infer<typeof AssignPermissionGroupPermissionsResSchema>
