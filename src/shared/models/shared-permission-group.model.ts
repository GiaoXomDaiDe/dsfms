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

export type PermissionGroupType = z.infer<typeof PermissionGroupSchema>
export type PermissionGroupPermissionType = z.infer<typeof PermissionGroupPermissionSchema>
