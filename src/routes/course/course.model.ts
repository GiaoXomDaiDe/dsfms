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

// Course Detail Response Schema
export const CourseDetailResSchema = CourseWithInfoSchema

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

// Type exports
export type CourseType = z.infer<typeof CourseSchema>
export type CourseWithInfoType = z.infer<typeof CourseWithInfoSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type GetCoursesQueryType = z.infer<typeof GetCoursesQuerySchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type CourseDetailResType = z.infer<typeof CourseDetailResSchema>
export type CourseStatsType = z.infer<typeof CourseStatsSchema>

// DTO exports
export class CreateCourseBodyDto extends createZodDto(CreateCourseBodySchema) {}
export class UpdateCourseBodyDto extends createZodDto(UpdateCourseBodySchema) {}
export class GetCoursesQueryDto extends createZodDto(GetCoursesQuerySchema) {}
export class GetCoursesResDto extends createZodDto(GetCoursesResSchema) {}
export class CourseDetailResDto extends createZodDto(CourseDetailResSchema) {}
export class CourseStatsDto extends createZodDto(CourseStatsSchema) {}
