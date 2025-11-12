import { HttpMethod } from '@prisma/client'
import z from 'zod'
import { hasAlphabeticCharacter, optionalAlphabeticCharacter } from '~/shared/constants/validation.constant'

const HAS_ALPHABETIC_MESSAGE = 'Must include at least one alphabetic character'

export const PermissionSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, 'Permission name is required')
    .max(250)
    .refine(hasAlphabeticCharacter, { message: HAS_ALPHABETIC_MESSAGE }),
  description: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine(optionalAlphabeticCharacter, { message: HAS_ALPHABETIC_MESSAGE }),
  path: z
    .string()
    .trim()
    .min(1, 'Permission path is required')
    .max(500)
    .refine(hasAlphabeticCharacter, { message: HAS_ALPHABETIC_MESSAGE }),
  module: z
    .string()
    .trim()
    .min(1, 'Permission module is required')
    .max(100)
    .refine(hasAlphabeticCharacter, { message: HAS_ALPHABETIC_MESSAGE }),
  method: z.enum(
    [
      HttpMethod.GET,
      HttpMethod.POST,
      HttpMethod.PUT,
      HttpMethod.DELETE,
      HttpMethod.PATCH,
      HttpMethod.HEAD,
      HttpMethod.OPTIONS
    ],
    {
      error: ({ values }) => {
        return { message: `Method must be one of: ${values.join(', ')}` }
      }
    }
  ),
  isActive: z.boolean().default(true),
  viewName: z
    .string()
    .trim()
    .max(250)
    .nullable()
    .refine(optionalAlphabeticCharacter, { message: HAS_ALPHABETIC_MESSAGE })
    .default(''),
  viewModule: z
    .string()
    .trim()
    .max(250)
    .nullable()
    .refine(optionalAlphabeticCharacter, { message: HAS_ALPHABETIC_MESSAGE })
    .default(''),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .nullable(),
  createdAt: z.iso.datetime().transform((value) => new Date(value)),
  updatedAt: z.iso.datetime().transform((value) => new Date(value))
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
export type GetPermissionParamsType = z.infer<typeof GetPermissionParamsSchema>
export type GetPermissionDetailResType = z.infer<typeof GetPermissionDetailResSchema>
export type CreatePermissionBodyType = z.infer<typeof CreatePermissionBodySchema>
export type UpdatePermissionBodyType = z.infer<typeof UpdatePermissionBodySchema>
