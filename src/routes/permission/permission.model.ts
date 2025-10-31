import { HttpMethod } from '@prisma/client'
import z from 'zod'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'

export const PermissionSchema = z.object({
  id: z.uuid(),
  name: z.string().max(250),
  description: z.string().nullable(),
  path: z.string().max(500),
  module: z.string().max(100),
  method: z.enum([
    HttpMethod.GET,
    HttpMethod.POST,
    HttpMethod.PUT,
    HttpMethod.DELETE,
    HttpMethod.PATCH,
    HttpMethod.HEAD,
    HttpMethod.OPTIONS
  ]),
  isActive: z.boolean().default(true),
  viewName: z.string().max(250).nullable().default(''),
  viewModule: z.string().max(250).nullable().default(''),
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

export const GetPermissionsQuerySchema = IncludeDeletedQuerySchema.strict()

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

export type PermissionType = z.infer<typeof PermissionSchema>
export type GetPermissionsResType = z.infer<typeof GetPermissionsResSchema>
export type PermissionModuleType = z.infer<typeof PermissionModuleSchema>
export type PermissionListItemType = z.infer<typeof PermissionListItemSchema>
export type GetPermissionsQueryType = z.infer<typeof GetPermissionsQuerySchema>
export type GetPermissionParamsType = z.infer<typeof GetPermissionParamsSchema>
export type GetPermissionDetailResType = z.infer<typeof GetPermissionDetailResSchema>
export type CreatePermissionBodyType = z.infer<typeof CreatePermissionBodySchema>
export type UpdatePermissionBodyType = z.infer<typeof UpdatePermissionBodySchema>
