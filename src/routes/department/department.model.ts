import z from 'zod'

export const DepartmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable(),
  headUserId: z.uuid().nullable(),
  isActive: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type DepartmentType = z.infer<typeof DepartmentSchema>

// Create Department Schema
export const CreateDepartmentBodySchema = DepartmentSchema.pick({
  name: true,
  description: true,
  headUserId: true,
  isActive: true
})

export type CreateDepartmentBodyType = z.infer<typeof CreateDepartmentBodySchema>

// Update Department Schema
export const UpdateDepartmentBodySchema = CreateDepartmentBodySchema.partial()

export type UpdateDepartmentBodyType = z.infer<typeof UpdateDepartmentBodySchema>

// Department with additional info
export const DepartmentWithInfoSchema = DepartmentSchema.extend({
  courseCount: z.number().default(0),
  headUser: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string()
    })
    .nullable()
})

export type DepartmentWithInfoType = z.infer<typeof DepartmentWithInfoSchema>

// Response Schemas
export const GetDepartmentsResSchema = z.object({
  departments: z.array(DepartmentWithInfoSchema),
  totalItems: z.number()
})

export const GetDepartmentParamsSchema = z
  .object({
    departmentId: z.uuid()
  })
  .strict()

export const GetDepartmentsQuerySchema = z
  .object({
    includeDeleted: z.coerce.boolean().default(false).optional()
  })
  .strict()

export const GetDepartmentDetailResSchema = DepartmentWithInfoSchema

export const CreateDepartmentResSchema = DepartmentSchema

// Types
export type GetDepartmentsResType = z.infer<typeof GetDepartmentsResSchema>
export type GetDepartmentDetailResType = z.infer<typeof GetDepartmentDetailResSchema>
export type CreateDepartmentResType = z.infer<typeof CreateDepartmentResSchema>
export type GetDepartmentParamsType = z.infer<typeof GetDepartmentParamsSchema>
export type GetDepartmentsQueryType = z.infer<typeof GetDepartmentsQuerySchema>
