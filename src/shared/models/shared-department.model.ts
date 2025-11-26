import z from 'zod'
import { isoDatetimeSchema } from '~/shared/helpers/zod-validation.helper'

export const DepartmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().max(1000).nullable(),
  headUserId: z.uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema
})

export const departmentSummarySchema = DepartmentSchema.pick({
  id: true,
  name: true,
  isActive: true,
  description: true
})

export const departmentIdNameSchema = DepartmentSchema.pick({
  id: true,
  name: true
})

export type DepartmentType = z.infer<typeof DepartmentSchema>
export type DepartmentSummaryType = z.infer<typeof departmentSummarySchema>
export type DepartmentIdNameType = z.infer<typeof departmentIdNameSchema>
