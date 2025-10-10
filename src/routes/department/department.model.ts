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
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  headUser: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      middleName: z.string().nullable(),
      email: z.string(),
      role: z.object({
        id: z.string(),
        name: z.string()
      })
    })
    .nullable()
})

// Trainer Detail Schema
export const DepartmentTrainerSchema = z.object({
  id: z.string(),
  eid: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  email: z.string(),
  status: z.string().nullable(),
  address: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  gender: z.string().nullable(),
  phoneNumber: z.string().nullable()
})

// Course Detail Schema for Department
export const DepartmentCourseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  maxNumTrainee: z.number().nullable(),
  venue: z.string().nullable(),
  note: z.string().nullable(),
  passScore: z.number().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  level: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  subjectCount: z.number().default(0)
})

export const DepartmentDetailResSchema = DepartmentResSchema.extend({
  courseCount: z.number().default(0),
  traineeCount: z.number().default(0),
  trainerCount: z.number().default(0),
  trainers: z.array(DepartmentTrainerSchema),
  courses: z.array(DepartmentCourseSchema)
})

export type DepartmentDetailResType = z.infer<typeof DepartmentDetailResSchema>
export type DepartmentTrainerType = z.infer<typeof DepartmentTrainerSchema>
export type DepartmentCourseType = z.infer<typeof DepartmentCourseSchema>

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

export const GetDepartmentDetailQuerySchema = z
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
export type GetDepartmentDetailQueryType = z.infer<typeof GetDepartmentDetailQuerySchema>

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

// Remove Trainers Schema
export const RemoveTrainersFromDepartmentBodySchema = z
  .object({
    trainerEids: z.array(z.string().min(1))
  })
  .strict()

export const RemoveTrainersFromDepartmentParamsSchema = z
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

export type DepartmentHeadUserType = z.infer<typeof DepartmentHeadUserSchema>
export type GetDepartmentHeadsResType = z.infer<typeof GetDepartmentHeadsResSchema>
export type AddTrainersToDepartmentBodyType = z.infer<typeof AddTrainersToDepartmentBodySchema>
export type AddTrainersToDepartmentParamsType = z.infer<typeof AddTrainersToDepartmentParamsSchema>
export type RemoveTrainersFromDepartmentBodyType = z.infer<typeof RemoveTrainersFromDepartmentBodySchema>
export type RemoveTrainersFromDepartmentParamsType = z.infer<typeof RemoveTrainersFromDepartmentParamsSchema>
export type UpdateDepartmentEnhancedBodyType = z.infer<typeof UpdateDepartmentEnhancedBodySchema>
export type UpdateDepartmentEnhancedResType = z.infer<typeof UpdateDepartmentEnhancedResSchema>
