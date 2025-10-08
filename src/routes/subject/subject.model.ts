import { SubjectEnrollmentStatus, SubjectInstructorRole, SubjectMethod, SubjectType } from '@prisma/client'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Base Subject Schema
export const SubjectSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  method: z.nativeEnum(SubjectMethod),
  duration: z.number().int().positive().optional().nullable(),
  type: z.nativeEnum(SubjectType),
  roomName: z.string().optional().nullable(),
  remarkNote: z.string().optional().nullable(),
  timeSlot: z.string().optional().nullable(),
  isSIM: z.boolean(),
  passScore: z.number().min(0).max(100).optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional().nullable()
})

// Course info schema for nested relations
export const SubjectCourseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  departmentId: z.string().uuid(),
  department: z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string()
  })
})

// User info schema for created/updated by
export const SubjectUserSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string()
})

// Instructor info schema
export const SubjectInstructorSchema = z.object({
  trainerUserId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roleInSubject: z.nativeEnum(SubjectInstructorRole),
  trainer: SubjectUserSchema,
  createdAt: z.string().datetime()
})

// Enrollment info schema
export const SubjectEnrollmentSchema = z.object({
  traineeUserId: z.string().uuid(),
  subjectId: z.string().uuid(),
  enrollmentDate: z.string().datetime(),
  batchCode: z.string(),
  status: z.nativeEnum(SubjectEnrollmentStatus),
  trainee: SubjectUserSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

// Subject with relations
export const SubjectWithInfoSchema = SubjectSchema.extend({
  course: SubjectCourseSchema.optional(),
  createdBy: SubjectUserSchema.optional().nullable(),
  updatedBy: SubjectUserSchema.optional().nullable(),
  instructors: z.array(SubjectInstructorSchema).optional().default([]),
  enrollments: z.array(SubjectEnrollmentSchema).optional().default([]),
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

// Create Subject Body Schema
export const CreateSubjectBodySchema = z
  .object({
    courseId: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    code: z.string().min(1).max(50),
    description: z.string().optional(),
    method: z.nativeEnum(SubjectMethod),
    duration: z.number().int().positive().optional(),
    type: z.nativeEnum(SubjectType),
    roomName: z.string().optional(),
    remarkNote: z.string().optional(),
    timeSlot: z.string().optional(),
    isSIM: z.boolean().default(false),
    passScore: z.number().min(0).max(100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
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

// Update Subject Body Schema
export const UpdateSubjectBodySchema = CreateSubjectBodySchema.partial()

// Bulk Create Subjects Body Schema
export const BulkCreateSubjectsBodySchema = z.object({
  courseId: z.string().uuid(),
  subjects: z
    .array(CreateSubjectBodySchema.omit({ courseId: true }))
    .min(1)
    .max(50)
})

// Bulk Create Subjects Response Schema
export const BulkCreateSubjectsResSchema = z.object({
  createdSubjects: z.array(SubjectSchema),
  failedSubjects: z.array(
    z.object({
      subject: CreateSubjectBodySchema.omit({ courseId: true }),
      error: z.string()
    })
  ),
  summary: z.object({
    totalRequested: z.number().int(),
    totalCreated: z.number().int(),
    totalFailed: z.number().int()
  })
})

// Subject Query Schema
export const GetSubjectsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
  search: z.string().optional(),
  courseId: z.string().uuid().optional(),
  method: z.nativeEnum(SubjectMethod).optional(),
  type: z.nativeEnum(SubjectType).optional(),
  isSIM: z
    .string()
    .regex(/^(true|false)$/)
    .transform((val) => val === 'true')
    .optional(),
  includeDeleted: z
    .string()
    .regex(/^(true|false)$/)
    .transform((val) => val === 'true')
    .optional()
    .default(false)
})

// Get Subjects Response Schema
export const GetSubjectsResSchema = z.object({
  subjects: z.array(SubjectWithInfoSchema),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int()
})

// Subject Detail Response Schema
export const SubjectDetailResSchema = SubjectWithInfoSchema

// Add Instructors Body Schema
export const AddInstructorsBodySchema = z.object({
  instructors: z.array(
    z.object({
      trainerEid: z.string().min(1),
      roleInSubject: z.nativeEnum(SubjectInstructorRole)
    })
  )
})

// Remove Instructors Body Schema
export const RemoveInstructorsBodySchema = z.object({
  trainerEids: z.array(z.string().min(1))
})

// Enroll Trainees Body Schema
export const EnrollTraineesBodySchema = z.object({
  trainees: z.array(
    z.object({
      traineeEid: z.string().min(1),
      batchCode: z.string().min(1)
    })
  )
})

// Remove Enrollments Body Schema
export const RemoveEnrollmentsBodySchema = z.object({
  traineeEids: z.array(z.string().min(1))
})

// Update Enrollment Status Body Schema
export const UpdateEnrollmentStatusBodySchema = z.object({
  traineeEid: z.string().min(1),
  status: z.nativeEnum(SubjectEnrollmentStatus)
})

// Subject Statistics Schema
export const SubjectStatsSchema = z.object({
  totalSubjects: z.number().int(),
  subjectsByMethod: z.record(z.string(), z.number().int()),
  subjectsByType: z.record(z.string(), z.number().int()),
  subjectsByCourse: z.array(
    z.object({
      courseId: z.string().uuid(),
      courseName: z.string(),
      count: z.number().int()
    })
  )
})

// Type exports
export type SubjectEntityType = z.infer<typeof SubjectSchema>
export type SubjectWithInfoType = z.infer<typeof SubjectWithInfoSchema>
export type CreateSubjectBodyType = z.infer<typeof CreateSubjectBodySchema>
export type UpdateSubjectBodyType = z.infer<typeof UpdateSubjectBodySchema>
export type GetSubjectsQueryType = z.infer<typeof GetSubjectsQuerySchema>
export type GetSubjectsResType = z.infer<typeof GetSubjectsResSchema>
export type SubjectDetailResType = z.infer<typeof SubjectDetailResSchema>
export type AddInstructorsBodyType = z.infer<typeof AddInstructorsBodySchema>
export type RemoveInstructorsBodyType = z.infer<typeof RemoveInstructorsBodySchema>
export type EnrollTraineesBodyType = z.infer<typeof EnrollTraineesBodySchema>
export type RemoveEnrollmentsBodyType = z.infer<typeof RemoveEnrollmentsBodySchema>
export type UpdateEnrollmentStatusBodyType = z.infer<typeof UpdateEnrollmentStatusBodySchema>
export type SubjectStatsType = z.infer<typeof SubjectStatsSchema>
export type BulkCreateSubjectsBodyType = z.infer<typeof BulkCreateSubjectsBodySchema>
export type BulkCreateSubjectsResType = z.infer<typeof BulkCreateSubjectsResSchema>

// DTO exports
export class CreateSubjectBodyDto extends createZodDto(CreateSubjectBodySchema) {}
export class UpdateSubjectBodyDto extends createZodDto(UpdateSubjectBodySchema) {}
export class GetSubjectsQueryDto extends createZodDto(GetSubjectsQuerySchema) {}
export class GetSubjectsResDto extends createZodDto(GetSubjectsResSchema) {}
export class SubjectDetailResDto extends createZodDto(SubjectDetailResSchema) {}
export class AddInstructorsBodyDto extends createZodDto(AddInstructorsBodySchema) {}
export class RemoveInstructorsBodyDto extends createZodDto(RemoveInstructorsBodySchema) {}
export class EnrollTraineesBodyDto extends createZodDto(EnrollTraineesBodySchema) {}
export class RemoveEnrollmentsBodyDto extends createZodDto(RemoveEnrollmentsBodySchema) {}
export class BulkCreateSubjectsBodyDto extends createZodDto(BulkCreateSubjectsBodySchema) {}
export class BulkCreateSubjectsResDto extends createZodDto(BulkCreateSubjectsResSchema) {}
export class UpdateEnrollmentStatusBodyDto extends createZodDto(UpdateEnrollmentStatusBodySchema) {}
export class SubjectStatsDto extends createZodDto(SubjectStatsSchema) {}
