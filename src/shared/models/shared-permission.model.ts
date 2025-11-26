import { HttpMethod } from '@prisma/client'
import z from 'zod'
import {
  hasAlphabeticCharacter,
  isoDatetimeSchema,
  optionalAlphabeticCharacter
} from '~/shared/helpers/zod-validation.helper'

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
      error: ({ values }) => ({ message: `Method must be one of: ${values.join(', ')}` })
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
  deletedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema
})

export type PermissionType = z.infer<typeof PermissionSchema>
