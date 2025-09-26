import z from 'zod'

export const DepartmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
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
  code: true,
  description: true,
  headUserId: true
})

export type CreateDepartmentBodyType = z.infer<typeof CreateDepartmentBodySchema>

// Update Department Schema
export const UpdateDepartmentBodySchema = CreateDepartmentBodySchema.partial()

export type UpdateDepartmentBodyType = z.infer<typeof UpdateDepartmentBodySchema>

// Department with additional info
export const DepartmentResSchema = DepartmentSchema.extend({
  headUser: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string()
    })
    .nullable()
})

export const DepartmentDetailResSchema = DepartmentResSchema.extend({
  courseCount: z.number().default(0),
  traineeCount: z.number().default(0),
  trainerCount: z.number().default(0)
})

export type DepartmentDetailResType = z.infer<typeof DepartmentDetailResSchema>

// Response Schemas
export const GetDepartmentsResSchema = z.object({
  departments: z.array(DepartmentResSchema),
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

export const GetDepartmentDetailResSchema = DepartmentDetailResSchema

export const CreateDepartmentResSchema = DepartmentSchema

// Types
export type GetDepartmentsResType = z.infer<typeof GetDepartmentsResSchema>
export type GetDepartmentDetailResType = z.infer<typeof GetDepartmentDetailResSchema>
export type CreateDepartmentResType = z.infer<typeof CreateDepartmentResSchema>
export type GetDepartmentParamsType = z.infer<typeof GetDepartmentParamsSchema>
export type GetDepartmentsQueryType = z.infer<typeof GetDepartmentsQuerySchema>

// Department Head Users Schema
export const DepartmentHeadUserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  eid: z.string().nullable()
})

export const GetDepartmentHeadsResSchema = z.object({
  users: z.array(DepartmentHeadUserSchema),
  totalItems: z.number()
})

// Add Trainers Schema
export const AddTrainersToDepartmentBodySchema = z
  .object({
    trainerEids: z.array(z.string().min(1))
  })
  .strict()

export const AddTrainersToDepartmentParamsSchema = z
  .object({
    departmentId: z.uuid()
  })
  .strict()

// Update Department Enhanced Schema (includes code and returns department heads)
export const UpdateDepartmentEnhancedBodySchema = DepartmentSchema.pick({
  name: true,
  code: true,
  description: true,
  headUserId: true
}).strict()

export const UpdateDepartmentEnhancedResSchema = z.object({
  department: DepartmentDetailResSchema,
  availableDepartmentHeads: z.array(DepartmentHeadUserSchema)
})

// Types
export type DepartmentHeadUserType = z.infer<typeof DepartmentHeadUserSchema>
export type GetDepartmentHeadsResType = z.infer<typeof GetDepartmentHeadsResSchema>
export type AddTrainersToDepartmentBodyType = z.infer<typeof AddTrainersToDepartmentBodySchema>
export type AddTrainersToDepartmentParamsType = z.infer<typeof AddTrainersToDepartmentParamsSchema>
export type UpdateDepartmentEnhancedBodyType = z.infer<typeof UpdateDepartmentEnhancedBodySchema>
export type UpdateDepartmentEnhancedResType = z.infer<typeof UpdateDepartmentEnhancedResSchema>
