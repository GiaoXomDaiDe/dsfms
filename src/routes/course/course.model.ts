import { CourseLevel, CourseStatus } from '@prisma/client'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Base Course Schema
export const CourseSchema = z.object({
  id: z.string().uuid(),
  departmentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  code: z.string().min(1).max(50),
  maxNumTrainee: z.number().int().positive().optional().nullable(),
  venue: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  passScore: z.number().min(0).max(100).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  level: z.nativeEnum(CourseLevel),
  status: z.nativeEnum(CourseStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional().nullable()
})

// Department info schema for nested relations
export const CourseDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string()
})

// User info schema for created/updated by
export const CourseUserSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string()
})

// Course with relations
export const CourseWithInfoSchema = CourseSchema.extend({
  department: CourseDepartmentSchema.optional(),
  createdBy: CourseUserSchema.optional().nullable(),
  updatedBy: CourseUserSchema.optional().nullable(),
  subjectCount: z.number().int().default(0),
  traineeCount: z.number().int().default(0),
  trainerCount: z.number().int().default(0)
})

// Create Course Body Schema
export const CreateCourseBodySchema = z
  .object({
    departmentId: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    code: z.string().min(1).max(50),
    maxNumTrainee: z.number().int().positive().optional(),
    venue: z.string().optional(),
    note: z.string().optional(),
    passScore: z.number().min(0).max(100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    level: z.nativeEnum(CourseLevel),
    status: z.nativeEnum(CourseStatus).default(CourseStatus.PLANNED)
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate)
      }
      return true
    },
    {
      message: 'End date must be after start date',
      path: ['endDate']
    }
  )

// Update Course Body Schema
export const UpdateCourseBodySchema = CreateCourseBodySchema.partial()

// Course Query Schema
export const GetCoursesQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  level: z.nativeEnum(CourseLevel).optional(),
  status: z.nativeEnum(CourseStatus).optional(),
  courseIds: z.array(z.string().uuid()).optional(),
  includeDeleted: z
    .string()
    .regex(/^(true|false)$/)
    .transform((val) => val === 'true')
    .optional()
    .default(false)
})

// Get Courses Response Schema
export const GetCoursesResSchema = z.object({
  courses: z.array(CourseWithInfoSchema),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int()
})

// Subject summary schema for course details
export const CourseSubjectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  method: z.string(), // Will be SubjectMethod enum
  duration: z.number().int().optional().nullable(),
  type: z.string(), // Will be SubjectType enum
  roomName: z.string().optional().nullable(),
  timeSlot: z.string().optional().nullable(),
  isSIM: z.boolean(),
  passScore: z.number().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

// Course Detail Response Schema
export const CourseDetailResSchema = CourseWithInfoSchema.extend({
  subjects: z.array(CourseSubjectSummarySchema).default([])
})

// Course Statistics Schema
export const CourseStatsSchema = z.object({
  totalCourses: z.number().int(),
  coursesByLevel: z.record(z.string(), z.number().int()),
  coursesByStatus: z.record(z.string(), z.number().int()),
  coursesByDepartment: z.array(
    z.object({
      departmentId: z.string().uuid(),
      departmentName: z.string(),
      count: z.number().int()
    })
  )
})

// Department with Courses Response Schema (without pagination)
export const DepartmentWithCoursesSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  description: z.string().optional().nullable(),
  headUser: CourseUserSchema.optional().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  courses: z.array(CourseWithInfoSchema)
})

// Type exports
export type CourseType = z.infer<typeof CourseSchema>
export type CourseWithInfoType = z.infer<typeof CourseWithInfoSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type GetCoursesQueryType = z.infer<typeof GetCoursesQuerySchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type CourseDetailResType = z.infer<typeof CourseDetailResSchema>
export type CourseStatsType = z.infer<typeof CourseStatsSchema>
export type DepartmentWithCoursesType = z.infer<typeof DepartmentWithCoursesSchema>

// DTO exports
export class CreateCourseBodyDto extends createZodDto(CreateCourseBodySchema) {}
// Add Subject to Course Schema
export const AddSubjectToCourseBodySchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, 'At least one subject is required')
})

export type AddSubjectToCourseBodyType = z.infer<typeof AddSubjectToCourseBodySchema>

export const AddSubjectToCourseResSchema = z.object({
  success: z.boolean(),
  addedSubjects: z.array(z.string().uuid()),
  notFoundSubjects: z.array(z.string().uuid()),
  alreadyAssignedSubjects: z.array(z.string().uuid()),
  message: z.string()
})

export type AddSubjectToCourseResType = z.infer<typeof AddSubjectToCourseResSchema>

// Remove Subject from Course Schema
export const RemoveSubjectFromCourseBodySchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, 'At least one subject is required')
})

export type RemoveSubjectFromCourseBodyType = z.infer<typeof RemoveSubjectFromCourseBodySchema>

export const RemoveSubjectFromCourseResSchema = z.object({
  success: z.boolean(),
  removedSubjects: z.array(z.string().uuid()),
  notFoundSubjects: z.array(z.string().uuid()),
  notAssignedSubjects: z.array(z.string().uuid()),
  message: z.string()
})

export type RemoveSubjectFromCourseResType = z.infer<typeof RemoveSubjectFromCourseResSchema>

export class UpdateCourseBodyDto extends createZodDto(UpdateCourseBodySchema) {}
export class GetCoursesQueryDto extends createZodDto(GetCoursesQuerySchema) {}
export class GetCoursesResDto extends createZodDto(GetCoursesResSchema) {}
export class CourseDetailResDto extends createZodDto(CourseDetailResSchema) {}
export class CourseStatsDto extends createZodDto(CourseStatsSchema) {}
export class DepartmentWithCoursesDto extends createZodDto(DepartmentWithCoursesSchema) {}
export class AddSubjectToCourseBodyDto extends createZodDto(AddSubjectToCourseBodySchema) {}
export class AddSubjectToCourseResDto extends createZodDto(AddSubjectToCourseResSchema) {}
export class RemoveSubjectFromCourseBodyDto extends createZodDto(RemoveSubjectFromCourseBodySchema) {}
export class RemoveSubjectFromCourseResDto extends createZodDto(RemoveSubjectFromCourseResSchema) {}
