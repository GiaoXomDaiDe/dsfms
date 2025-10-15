import {
  SubjectEnrollmentStatus,
  SubjectInstructorRole,
  SubjectMethod,
  SubjectStatus,
  SubjectType
} from '@prisma/client'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { UserLookupResSchema } from '~/shared/models/shared-user-list.model'

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
  startDate: z.date(),
  status: z.nativeEnum(SubjectStatus),
  endDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable()
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

// Instructor info schema (simplified for response)
export const SubjectInstructorSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  roleInSubject: z.nativeEnum(SubjectInstructorRole),
  assignedAt: z.date()
})

// Enrollment info schema (simplified for response)
export const SubjectEnrollmentSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  enrollmentDate: z.date(),
  batchCode: z.string(),
  status: z.nativeEnum(SubjectEnrollmentStatus)
})

// Subject with relations (for response - no createdBy/updatedBy)
export const SubjectWithInfoSchema = SubjectSchema.extend({
  course: SubjectCourseSchema.optional(),
  instructors: z.array(SubjectInstructorSchema).optional().default([]),
  enrollments: z.array(SubjectEnrollmentSchema).optional().default([]),
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

// Subject with relations including user info (for internal use)
export const SubjectWithUserInfoSchema = SubjectSchema.extend({
  course: SubjectCourseSchema.optional(),
  createdBy: SubjectUserSchema.optional().nullable(),
  updatedBy: SubjectUserSchema.optional().nullable(),
  instructors: z.array(SubjectInstructorSchema).optional().default([]),
  enrollments: z.array(SubjectEnrollmentSchema).optional().default([]),
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

// Create Subject Body Schema
export const CreateSubjectBodySchema = SubjectSchema.refine(
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

// Update Subject Body Schema - includes status field
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

// Simple Subject Response Schema - Just basic subject entity
export const SubjectResSchema = SubjectSchema

// Subject Detail Response Schema (for complex operations)
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

// Batch Add Trainees to Course (All Subjects) Body Schema
export const BatchAddTraineesToCourseBodySchema = z.object({
  trainees: z.array(
    z.object({
      traineeEid: z.string().min(1),
      batchCode: z.string().min(1)
    })
  )
})

// Batch Add Trainees to Specific Subject Body Schema
export const BatchAddTraineesToSubjectBodySchema = z.object({
  trainees: z.array(
    z.object({
      traineeEid: z.string().min(1),
      batchCode: z.string().min(1)
    })
  )
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

// Add Instructors Response Schema
export const AddInstructorsResSchema = z.object({
  success: z.boolean(),
  addedInstructors: z.array(z.string()),
  duplicateInstructors: z.array(z.string()),
  message: z.string()
})

// Remove Instructors Response Schema
export const RemoveInstructorsResSchema = z.object({
  success: z.boolean(),
  removedInstructors: z.array(z.string()),
  notFoundInstructors: z.array(z.string()),
  message: z.string()
})

// Enroll Trainees Response Schema
export const EnrollTraineesResSchema = z.object({
  success: z.boolean(),
  enrolledTrainees: z.array(z.string()),
  duplicateTrainees: z.array(z.string()),
  message: z.string()
})

// Remove Enrollments Response Schema
export const RemoveEnrollmentsResSchema = z.object({
  success: z.boolean(),
  removedTrainees: z.array(z.string()),
  notFoundTrainees: z.array(z.string()),
  message: z.string()
})

// Batch Add Trainees to Course Response Schema
export const BatchAddTraineesToCourseResSchema = z.object({
  success: z.boolean(),
  enrolledSubjects: z.array(
    z.object({
      subjectId: z.string().uuid(),
      subjectName: z.string(),
      enrolledTrainees: z.array(z.string()),
      duplicateTrainees: z.array(z.string())
    })
  ),
  totalEnrolledCount: z.number(),
  totalDuplicateCount: z.number(),
  message: z.string()
})

// Batch Add Trainees to Subject Response Schema
export const BatchAddTraineesToSubjectResSchema = z.object({
  success: z.boolean(),
  enrolledTrainees: z.array(z.string()),
  duplicateTrainees: z.array(z.string()),
  notFoundTrainees: z.array(z.string()),
  message: z.string()
})

// Bulk Multi-Subject Enrollment Schemas
export const SubjectEnrollmentItemSchema = z.object({
  subjectId: z.string().uuid(),
  trainees: z
    .array(
      z.object({
        traineeEid: z.string().min(1),
        batchCode: z.string().min(1)
      })
    )
    .min(1, 'At least one trainee required per subject')
})

export const BulkMultiSubjectEnrollmentBodySchema = z.object({
  enrollments: z
    .array(SubjectEnrollmentItemSchema)
    .min(1, 'At least one subject enrollment required')
    .max(50, 'Maximum 50 subjects allowed per request')
})

export const SubjectEnrollmentResultSchema = z.object({
  subjectId: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string(),
  success: z.boolean(),
  enrolledTrainees: z.array(z.string()),
  duplicateTrainees: z.array(z.string()),
  notFoundTrainees: z.array(z.string()),
  message: z.string()
})

export const BulkMultiSubjectEnrollmentResSchema = z.object({
  results: z.array(SubjectEnrollmentResultSchema),
  summary: z.object({
    totalSubjects: z.number(),
    successfulSubjects: z.number(),
    failedSubjects: z.number(),
    totalTrainees: z.number(),
    enrolledTrainees: z.number(),
    duplicateTrainees: z.number(),
    notFoundTrainees: z.number()
  })
})

// Course Trainees Overview Schema
export const CourseTraineeOverviewSchema = z.object({
  traineeId: z.string().uuid(),
  traineeEid: z.string(),
  traineeFirstName: z.string(),
  traineeLastName: z.string(),
  traineeMiddleName: z.string().nullable(),
  traineeEmail: z.string(),
  totalSubjectsInCourse: z.number(),
  enrolledSubjectsCount: z.number(),
  enrollments: z.array(
    z.object({
      subjectId: z.string().uuid(),
      subjectName: z.string(),
      subjectCode: z.string(),
      batchCode: z.string(),
      enrollmentDate: z.string().datetime(),
      status: z.nativeEnum(SubjectEnrollmentStatus)
    })
  )
})

export const CourseTraineesOverviewResSchema = z.object({
  courseId: z.string().uuid(),
  courseName: z.string(),
  courseCode: z.string(),
  trainees: z.array(CourseTraineeOverviewSchema),
  summary: z.object({
    totalTrainees: z.number(),
    totalSubjects: z.number(),
    totalEnrollments: z.number()
  })
})

// Trainee Subjects Overview Schema
export const TraineeSubjectOverviewSchema = z.object({
  subjectId: z.string().uuid(),
  subjectName: z.string(),
  subjectCode: z.string(),
  courseId: z.string().uuid(),
  courseName: z.string(),
  courseCode: z.string(),
  batchCode: z.string(),
  enrollmentDate: z.string().datetime(),
  status: z.nativeEnum(SubjectEnrollmentStatus),
  departmentName: z.string()
})

export const TraineeSubjectsOverviewResSchema = z.object({
  traineeId: z.string().uuid(),
  traineeEid: z.string(),
  traineeFirstName: z.string(),
  traineeLastName: z.string(),
  traineeMiddleName: z.string().nullable(),
  subjects: z.array(TraineeSubjectOverviewSchema),
  summary: z.object({
    totalSubjects: z.number(),
    totalCourses: z.number(),
    byStatus: z.record(z.string(), z.number())
  })
})

// Type exports
export type SubjectEntityType = z.infer<typeof SubjectSchema>
export type SubjectResType = z.infer<typeof SubjectResSchema>
export type SubjectWithInfoType = z.infer<typeof SubjectWithInfoSchema>
export type SubjectWithUserInfoType = z.infer<typeof SubjectWithUserInfoSchema>
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
export type BatchAddTraineesToCourseBodyType = z.infer<typeof BatchAddTraineesToCourseBodySchema>
export type BatchAddTraineesToSubjectBodyType = z.infer<typeof BatchAddTraineesToSubjectBodySchema>
export type SubjectStatsType = z.infer<typeof SubjectStatsSchema>
export type BulkCreateSubjectsBodyType = z.infer<typeof BulkCreateSubjectsBodySchema>
export type BulkCreateSubjectsResType = z.infer<typeof BulkCreateSubjectsResSchema>
export type AddInstructorsResType = z.infer<typeof AddInstructorsResSchema>
export type RemoveInstructorsResType = z.infer<typeof RemoveInstructorsResSchema>
export type EnrollTraineesResType = z.infer<typeof EnrollTraineesResSchema>
export type RemoveEnrollmentsResType = z.infer<typeof RemoveEnrollmentsResSchema>
export type BatchAddTraineesToCourseResType = z.infer<typeof BatchAddTraineesToCourseResSchema>
export type BatchAddTraineesToSubjectResType = z.infer<typeof BatchAddTraineesToSubjectResSchema>
export type SubjectEnrollmentItemType = z.infer<typeof SubjectEnrollmentItemSchema>
export type BulkMultiSubjectEnrollmentBodyType = z.infer<typeof BulkMultiSubjectEnrollmentBodySchema>
export type SubjectEnrollmentResultType = z.infer<typeof SubjectEnrollmentResultSchema>
export type BulkMultiSubjectEnrollmentResType = z.infer<typeof BulkMultiSubjectEnrollmentResSchema>
export type CourseTraineeOverviewType = z.infer<typeof CourseTraineeOverviewSchema>
export type CourseTraineesOverviewResType = z.infer<typeof CourseTraineesOverviewResSchema>
export type TraineeSubjectOverviewType = z.infer<typeof TraineeSubjectOverviewSchema>
export type TraineeSubjectsOverviewResType = z.infer<typeof TraineeSubjectsOverviewResSchema>

// DTO exports
export class CreateSubjectBodyDto extends createZodDto(CreateSubjectBodySchema) {}
export class UpdateSubjectBodyDto extends createZodDto(UpdateSubjectBodySchema) {}
export class GetSubjectsQueryDto extends createZodDto(GetSubjectsQuerySchema) {}
export class GetSubjectsResDto extends createZodDto(GetSubjectsResSchema) {}
export class SubjectResDto extends createZodDto(SubjectResSchema) {}
export class SubjectDetailResDto extends createZodDto(SubjectDetailResSchema) {}
export class AddInstructorsBodyDto extends createZodDto(AddInstructorsBodySchema) {}
export class RemoveInstructorsBodyDto extends createZodDto(RemoveInstructorsBodySchema) {}
export class EnrollTraineesBodyDto extends createZodDto(EnrollTraineesBodySchema) {}
export class RemoveEnrollmentsBodyDto extends createZodDto(RemoveEnrollmentsBodySchema) {}
export class BatchAddTraineesToCourseBodyDto extends createZodDto(BatchAddTraineesToCourseBodySchema) {}
export class BatchAddTraineesToSubjectBodyDto extends createZodDto(BatchAddTraineesToSubjectBodySchema) {}
export class BulkCreateSubjectsBodyDto extends createZodDto(BulkCreateSubjectsBodySchema) {}
export class BulkCreateSubjectsResDto extends createZodDto(BulkCreateSubjectsResSchema) {}
export class UpdateEnrollmentStatusBodyDto extends createZodDto(UpdateEnrollmentStatusBodySchema) {}
export class SubjectStatsDto extends createZodDto(SubjectStatsSchema) {}
export class AddInstructorsResDto extends createZodDto(AddInstructorsResSchema) {}
export class RemoveInstructorsResDto extends createZodDto(RemoveInstructorsResSchema) {}
export class EnrollTraineesResDto extends createZodDto(EnrollTraineesResSchema) {}
export class RemoveEnrollmentsResDto extends createZodDto(RemoveEnrollmentsResSchema) {}
export class BatchAddTraineesToCourseResDto extends createZodDto(BatchAddTraineesToCourseResSchema) {}
export class BatchAddTraineesToSubjectResDto extends createZodDto(BatchAddTraineesToSubjectResSchema) {}
export class BulkMultiSubjectEnrollmentBodyDto extends createZodDto(BulkMultiSubjectEnrollmentBodySchema) {}
export class BulkMultiSubjectEnrollmentResDto extends createZodDto(BulkMultiSubjectEnrollmentResSchema) {}
export class CourseTraineesOverviewResDto extends createZodDto(CourseTraineesOverviewResSchema) {}
export class TraineeSubjectsOverviewResDto extends createZodDto(TraineeSubjectsOverviewResSchema) {}

// ========================================
// TRAINER ASSIGNMENT SCHEMAS & DTOs
// ========================================

// Get Available Trainers Schema
export const GetAvailableTrainersQuerySchema = z.object({
  departmentId: z.uuid()
})

export const AvailableTrainerSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  departmentId: z.string().uuid().nullable()
})

export const GetAvailableTrainersResSchema = z.object({
  trainers: z.array(AvailableTrainerSchema),
  totalCount: z.number().int()
})

// Assign Trainer Schema
export const AssignTrainerBodySchema = z.object({
  trainerUserId: z.string().uuid(),
  roleInSubject: z.nativeEnum(SubjectInstructorRole)
})

export const AssignTrainerResSchema = z.object({
  message: z.string(),
  data: z.object({
    trainerUserId: z.string().uuid(),
    subjectId: z.string().uuid(),
    roleInSubject: z.nativeEnum(SubjectInstructorRole)
  })
})

// Update Trainer Assignment Schema - Only allow role update
export const UpdateTrainerAssignmentBodySchema = z.object({
  roleInSubject: z.nativeEnum(SubjectInstructorRole)
})

export const UpdateTrainerAssignmentResSchema = z.object({
  message: z.string(),
  data: z.object({
    trainerUserId: z.string().uuid(),
    subjectId: z.string().uuid(),
    roleInSubject: z.nativeEnum(SubjectInstructorRole)
  })
})

// Remove Trainer Schema
export const RemoveTrainerResSchema = z.object({
  message: z.string()
})

// ========================================
// TRAINEE ASSIGNMENT SCHEMAS & DTOs
// ========================================

// Lookup Trainees Schema
export const LookupTraineesBodySchema = z.object({
  trainees: z
    .array(
      z
        .object({
          eid: z.string().optional(),
          email: z.string().email().optional()
        })
        .refine((data) => data.eid || data.email, {
          message: 'Either eid or email must be provided'
        })
    )
    .min(1)
})

export { UserLookupResSchema as LookupTraineesResSchema } from '~/shared/models/shared-user-list.model'
export type { UserLookupResType as LookupTraineesResType } from '~/shared/models/shared-user-list.model'

// Assign Trainees Schema
export const AssignTraineesBodySchema = z.object({
  batchCode: z.string().min(1),
  traineeUserIds: z.array(z.string().uuid()).min(1)
})

const TraineeAssignmentDepartmentSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string()
  })
  .nullable()

export const TraineeAssignmentUserSchema = z.object({
  userId: z.string().uuid(),
  eid: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  department: TraineeAssignmentDepartmentSchema
})

export const TraineeAssignmentDuplicateSchema = TraineeAssignmentUserSchema.extend({
  enrolledAt: z.string().datetime(),
  batchCode: z.string()
})

export const TraineeAssignmentIssueSchema = z.object({
  submittedId: z.string().uuid(),
  eid: z.string().optional(),
  email: z.string().email().optional(),
  reason: z.enum(['USER_NOT_FOUND', 'ROLE_NOT_TRAINEE', 'USER_INACTIVE']),
  note: z.string().optional()
})

export const AssignTraineesResSchema = z.object({
  enrolledCount: z.number().int(),
  enrolled: z.array(TraineeAssignmentUserSchema)
})

// Get Course Trainees Schema
export const GetCourseTraineesQuerySchema = z.object({
  batchCode: z.string().optional()
})

export const CourseTraineeInfoSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  enrollmentCount: z.number().int(),
  batches: z.array(z.string())
})

export const GetCourseTraineesResSchema = z.object({
  trainees: z.array(CourseTraineeInfoSchema),
  totalItems: z.number().int()
})

// Cancel Course Enrollments Schema
export const CancelCourseEnrollmentsBodySchema = z.object({
  batchCode: z.string().min(1)
})

export const CancelCourseEnrollmentsResSchema = z.object({
  message: z.string(),
  data: z.object({
    cancelledCount: z.number().int(),
    notCancelledCount: z.number().int()
  })
})

// Get Trainee Enrollments Schema
export const GetTraineeEnrollmentsQuerySchema = z.object({
  batchCode: z.string().optional(),
  status: z.nativeEnum(SubjectEnrollmentStatus).optional()
})

export const TraineeEnrollmentUserSchema = z.object({
  userId: z.string().uuid(),
  eid: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  department: z
    .object({
      id: z.string().uuid(),
      name: z.string()
    })
    .nullable()
})

export const TraineeEnrollmentSubjectSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: z.nativeEnum(SubjectStatus),
  type: z.nativeEnum(SubjectType),
  method: z.nativeEnum(SubjectMethod),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  course: z
    .object({
      id: z.string().uuid(),
      name: z.string()
    })
    .nullable()
})

export const TraineeEnrollmentRecordSchema = z.object({
  subject: TraineeEnrollmentSubjectSchema,
  enrollment: z.object({
    batchCode: z.string(),
    status: z.nativeEnum(SubjectEnrollmentStatus),
    enrollmentDate: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
})

export const GetTraineeEnrollmentsResSchema = z.object({
  trainee: TraineeEnrollmentUserSchema,
  enrollments: z.array(TraineeEnrollmentRecordSchema),
  totalCount: z.number().int()
})

// Cancel Subject Enrollment Schema
export const CancelSubjectEnrollmentBodySchema = z.object({
  batchCode: z.string().min(1)
})

export const CancelSubjectEnrollmentResSchema = z.object({
  message: z.string()
})

// Type exports
export type GetAvailableTrainersQueryType = z.infer<typeof GetAvailableTrainersQuerySchema>
export type AvailableTrainerType = z.infer<typeof AvailableTrainerSchema>
export type GetAvailableTrainersResType = z.infer<typeof GetAvailableTrainersResSchema>
export type AssignTrainerBodyType = z.infer<typeof AssignTrainerBodySchema>
export type AssignTrainerResType = z.infer<typeof AssignTrainerResSchema>
export type UpdateTrainerAssignmentBodyType = z.infer<typeof UpdateTrainerAssignmentBodySchema>
export type UpdateTrainerAssignmentResType = z.infer<typeof UpdateTrainerAssignmentResSchema>
export type RemoveTrainerResType = z.infer<typeof RemoveTrainerResSchema>
export type LookupTraineesBodyType = z.infer<typeof LookupTraineesBodySchema>
export type AssignTraineesBodyType = z.infer<typeof AssignTraineesBodySchema>
export type AssignTraineesResType = z.infer<typeof AssignTraineesResSchema>
export type TraineeAssignmentUserType = z.infer<typeof TraineeAssignmentUserSchema>
export type TraineeAssignmentDuplicateType = z.infer<typeof TraineeAssignmentDuplicateSchema>
export type TraineeAssignmentIssueType = z.infer<typeof TraineeAssignmentIssueSchema>
export type GetCourseTraineesQueryType = z.infer<typeof GetCourseTraineesQuerySchema>
export type CourseTraineeInfoType = z.infer<typeof CourseTraineeInfoSchema>
export type GetCourseTraineesResType = z.infer<typeof GetCourseTraineesResSchema>
export type CancelCourseEnrollmentsBodyType = z.infer<typeof CancelCourseEnrollmentsBodySchema>
export type CancelCourseEnrollmentsResType = z.infer<typeof CancelCourseEnrollmentsResSchema>
export type GetTraineeEnrollmentsQueryType = z.infer<typeof GetTraineeEnrollmentsQuerySchema>
export type TraineeEnrollmentUserType = z.infer<typeof TraineeEnrollmentUserSchema>
export type TraineeEnrollmentSubjectType = z.infer<typeof TraineeEnrollmentSubjectSchema>
export type TraineeEnrollmentRecordType = z.infer<typeof TraineeEnrollmentRecordSchema>
export type GetTraineeEnrollmentsResType = z.infer<typeof GetTraineeEnrollmentsResSchema>
export type CancelSubjectEnrollmentBodyType = z.infer<typeof CancelSubjectEnrollmentBodySchema>
export type CancelSubjectEnrollmentResType = z.infer<typeof CancelSubjectEnrollmentResSchema>

// DTO exports
export class GetAvailableTrainersQueryDto extends createZodDto(GetAvailableTrainersQuerySchema) {}
export class GetAvailableTrainersResDto extends createZodDto(GetAvailableTrainersResSchema) {}
export class AssignTrainerBodyDto extends createZodDto(AssignTrainerBodySchema) {}
export class AssignTrainerResDto extends createZodDto(AssignTrainerResSchema) {}
export class UpdateTrainerAssignmentBodyDto extends createZodDto(UpdateTrainerAssignmentBodySchema) {}
export class UpdateTrainerAssignmentResDto extends createZodDto(UpdateTrainerAssignmentResSchema) {}
export class RemoveTrainerResDto extends createZodDto(RemoveTrainerResSchema) {}
export class LookupTraineesBodyDto extends createZodDto(LookupTraineesBodySchema) {}
export class LookupTraineesResDto extends createZodDto(UserLookupResSchema) {}
export class AssignTraineesBodyDto extends createZodDto(AssignTraineesBodySchema) {}
export class AssignTraineesResDto extends createZodDto(AssignTraineesResSchema) {}
export class GetCourseTraineesQueryDto extends createZodDto(GetCourseTraineesQuerySchema) {}
export class GetCourseTraineesResDto extends createZodDto(GetCourseTraineesResSchema) {}
export class CancelCourseEnrollmentsBodyDto extends createZodDto(CancelCourseEnrollmentsBodySchema) {}
export class CancelCourseEnrollmentsResDto extends createZodDto(CancelCourseEnrollmentsResSchema) {}
export class GetTraineeEnrollmentsQueryDto extends createZodDto(GetTraineeEnrollmentsQuerySchema) {}
export class GetTraineeEnrollmentsResDto extends createZodDto(GetTraineeEnrollmentsResSchema) {}
export class CancelSubjectEnrollmentBodyDto extends createZodDto(CancelSubjectEnrollmentBodySchema) {}
export class CancelSubjectEnrollmentResDto extends createZodDto(CancelSubjectEnrollmentResSchema) {}
