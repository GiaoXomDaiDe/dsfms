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
  method: z.enum(HttpMethod),
  path: z.string(),
  module: z.string(),
  description: z.string().nullable(),
  viewModule: z.string().nullable(),
  viewName: z.string().nullable()
})

export const PermissionGroupCollectionItemSchema = z.object({
  code: z.string(),
  name: z.string()
})

export const PermissionGroupCollectionSchema = z.object({
  featureGroup: z.string(),
  permissions: PermissionGroupCollectionItemSchema.array()
})

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>
export type PermissionGroupPermissionType = z.infer<typeof PermissionGroupPermissionSchema>
export type PermissionGroupCollectionItemType = z.infer<typeof PermissionGroupCollectionItemSchema>
export type PermissionGroupCollectionType = z.infer<typeof PermissionGroupCollectionSchema>
