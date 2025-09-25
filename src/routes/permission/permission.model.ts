import z from 'zod'
import { HTTPMethod } from '~/shared/constants/auth.constant'
import { PaginationQuerySchema } from '~/shared/models/pagination.model'

export const PermissionSchema = z.object({
  id: z.uuid(),
  name: z.string().max(500),
  description: z.string().nullable(),
  path: z.string().max(1000),
  module: z.string().max(500),
  method: z.enum([
    HTTPMethod.GET,
    HTTPMethod.POST,
    HTTPMethod.PUT,
    HTTPMethod.DELETE,
    HTTPMethod.PATCH,
    HTTPMethod.OPTIONS,
    HTTPMethod.HEAD
  ]),
  isActive: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  viewName: z.string().max(500).nullable().default(''),
  viewModule: z.string().max(500).nullable().default(''),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const GetPermissionsResSchema = z.object({
  data: z.array(PermissionSchema),
  totalItems: z.number()
})

export const GetPermissionsQuerySchema = PaginationQuerySchema.extend({
  includeDeleted: z.coerce.boolean().default(false).optional()
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

export type PermissionType = z.infer<typeof PermissionSchema>
export type GetPermissionsResType = z.infer<typeof GetPermissionsResSchema>
export type GetPermissionsQueryType = z.infer<typeof GetPermissionsQuerySchema>
export type GetPermissionParamsType = z.infer<typeof GetPermissionParamsSchema>
export type GetPermissionDetailResType = z.infer<typeof GetPermissionDetailResSchema>
export type CreatePermissionBodyType = z.infer<typeof CreatePermissionBodySchema>
export type UpdatePermissionBodyType = z.infer<typeof UpdatePermissionBodySchema>
