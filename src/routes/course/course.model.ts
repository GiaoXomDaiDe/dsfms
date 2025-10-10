import { CourseLevel, CourseStatus } from '@prisma/client'
import { z } from 'zod'

/* ===========================
 * Base Schemas
 * ========================== */

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

/* ===========================
 * Nested Relation Schemas
 * ========================== */

// Department info for course relations
export const CourseDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string()
})

// User info for audit fields (created/updated by)
export const CourseUserSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string()
})

// Subject summary for course details
export const CourseSubjectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  method: z.string(),
  duration: z.number().int().optional().nullable(),
  type: z.string(),
  roomName: z.string().optional().nullable(),
  timeSlot: z.string().optional().nullable(),
  isSIM: z.boolean(),
  passScore: z.number().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

/* ===========================
 * Extended Response Schemas
 * ========================== */

// Course with basic info (for list endpoints) - simplified without counts
export const CourseListItemSchema = CourseSchema.extend({
  department: CourseDepartmentSchema.optional(),
  createdBy: CourseUserSchema.optional().nullable(),
  updatedBy: CourseUserSchema.optional().nullable()
})

// Course with detailed info (for course detail endpoint)
export const CourseWithInfoSchema = CourseSchema.extend({
  department: CourseDepartmentSchema.optional(),
  createdBy: CourseUserSchema.optional().nullable(),
  updatedBy: CourseUserSchema.optional().nullable(),
  subjectCount: z.number().int().default(0),
  traineeCount: z.number().int().default(0),
  trainerCount: z.number().int().default(0)
})

// Course detail with full relations (for detail endpoint)
export const CourseDetailResSchema = CourseWithInfoSchema.extend({
  subjects: z.array(CourseSubjectSummarySchema).default([])
})

/* ===========================
 * Request/Input Schemas
 * ========================== */

// Course params for :id endpoints
export const GetCourseParamsSchema = z.object({
  id: z.string().uuid({ message: 'Invalid course ID format' })
})

// Create course body schema
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

// Update course body schema
export const UpdateCourseBodySchema = CreateCourseBodySchema.partial()

// Query parameters for courses (removed pagination)
export const GetCoursesQuerySchema = z.object({
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

/* ===========================
 * Response Schemas
 * ========================== */

// Simple courses list response (no pagination, no counts)
export const GetCoursesResSchema = z.object({
  courses: z.array(CourseListItemSchema),
  totalItems: z.number().int()
})

// Course statistics response
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

/* ===========================
 * Subject Management Schemas
 * ========================== */

// Add subjects to course
export const AddSubjectToCourseBodySchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, 'At least one subject is required')
})

export const AddSubjectToCourseResSchema = z.object({
  success: z.boolean(),
  addedSubjects: z.array(z.string().uuid()),
  notFoundSubjects: z.array(z.string().uuid()),
  alreadyAssignedSubjects: z.array(z.string().uuid()),
  message: z.string()
})

// Remove subjects from course
export const RemoveSubjectFromCourseBodySchema = z.object({
  subjectIds: z.array(z.string().uuid()).min(1, 'At least one subject is required')
})

export const RemoveSubjectFromCourseResSchema = z.object({
  success: z.boolean(),
  removedSubjects: z.array(z.string().uuid()),
  notFoundSubjects: z.array(z.string().uuid()),
  notAssignedSubjects: z.array(z.string().uuid()),
  message: z.string()
})

/* ===========================
 * Type Exports
 * ========================== */

export type CourseType = z.infer<typeof CourseSchema>
export type CourseListItemType = z.infer<typeof CourseListItemSchema>
export type CourseWithInfoType = z.infer<typeof CourseWithInfoSchema>
export type CourseDetailResType = z.infer<typeof CourseDetailResSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type GetCourseParamsType = z.infer<typeof GetCourseParamsSchema>
export type GetCoursesQueryType = z.infer<typeof GetCoursesQuerySchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type CourseStatsType = z.infer<typeof CourseStatsSchema>
export type AddSubjectToCourseBodyType = z.infer<typeof AddSubjectToCourseBodySchema>
export type AddSubjectToCourseResType = z.infer<typeof AddSubjectToCourseResSchema>
export type RemoveSubjectFromCourseBodyType = z.infer<typeof RemoveSubjectFromCourseBodySchema>
export type RemoveSubjectFromCourseResType = z.infer<typeof RemoveSubjectFromCourseResSchema>
