import z from 'zod'
import { isoDatetimeSchema, nullableUuidSchema } from '~/shared/helpers/zod-validation.helper'
import {
  departmentCodeSchema,
  departmentDescriptionSchema,
  departmentNameSchema
} from '~/shared/validation/department.validation'

export const DepartmentSchema = z.object({
  id: z.uuid(),
  name: departmentNameSchema,
  code: departmentCodeSchema,
  description: departmentDescriptionSchema,
  headUserId: nullableUuidSchema.optional(),
  isActive: z.boolean().default(true),
  createdById: nullableUuidSchema,
  updatedById: nullableUuidSchema,
  deletedById: nullableUuidSchema,
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
