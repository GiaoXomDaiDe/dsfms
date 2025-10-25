import { z } from 'zod'
import { CourseStatus } from '~/shared/constants/course.constant'
import {
  SubjectEnrollmentStatus,
  SubjectInstructorRole,
  SubjectMethod,
  SubjectStatus,
  SubjectType
} from '~/shared/constants/subject.constant'
import { SubjectIdParamsSchema, SubjectSchema } from '~/shared/models/shared-subject.model'
import { UserLookupResSchema, UserSchema } from '~/shared/models/shared-user.model'

export const GetSubjectsQuerySchema = SubjectSchema.pick({
  courseId: true,
  method: true,
  type: true,
  status: true,
  isSIM: true
}).partial()

export const GetSubjectsSchema = SubjectSchema.extend({
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

export const GetSubjectsResSchema = z.object({
  subjects: z.array(GetSubjectsSchema),
  totalItems: z.number().int()
})

export const SubjectDetailInstructorSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  status: true
}).extend({
  roleInSubject: z.enum(SubjectInstructorRole),
  assignedAt: z.iso.datetime().transform((value) => new Date(value))
})

export const SubjectDetailTraineeSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  status: true
}).extend({
  enrollmentDate: z.coerce.date(),
  enrollmentStatus: z.enum([
    SubjectEnrollmentStatus.ENROLLED,
    SubjectEnrollmentStatus.ON_GOING,
    SubjectEnrollmentStatus.CANCELLED,
    SubjectEnrollmentStatus.FINISHED
  ])
})

// Schema cho batch enrollments
export const SubjectDetailEnrollmentsByBatchSchema = z.object({
  batchCode: z.string(),
  trainees: z.array(SubjectDetailTraineeSchema)
})

// Schema cho course trong subject detail
export const SubjectDetailCourseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    code: z.string(),
    status: z.enum([CourseStatus.PLANNED, CourseStatus.ON_GOING, CourseStatus.COMPLETED, CourseStatus.ARCHIVED]),
    department: z.object({
      id: z.uuid(),
      name: z.string(),
      code: z.string(),
      isActive: z.boolean()
    })
  })
  .nullable()

export const GetSubjectDetailResSchema = SubjectSchema.omit({
  courseId: true
}).extend({
  course: SubjectDetailCourseSchema,
  instructors: z.array(SubjectDetailInstructorSchema).default([]),
  enrollmentsByBatch: z.array(SubjectDetailEnrollmentsByBatchSchema).default([])
})

export const AvailableTrainerSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  lastName: true,
  email: true,
  departmentId: true
})

export const GetAvailableTrainersResSchema = z.object({
  trainers: z.array(AvailableTrainerSchema),
  totalCount: z.number().int()
})

export const SubjectTrainerParamsSchema = SubjectIdParamsSchema.extend({
  trainerId: z.uuid()
})

export const SubjectTraineeParamsSchema = SubjectIdParamsSchema.extend({
  traineeId: z.uuid()
})

export const CreateSubjectBodySchema = SubjectSchema.pick({
  courseId: true,
  name: true,
  code: true,
  description: true,
  method: true,
  type: true,
  roomName: true,
  remarkNote: true,
  timeSlot: true,
  isSIM: true,
  passScore: true,
  startDate: true,
  endDate: true
}).refine(
  ({ startDate, endDate }) => {
    if (startDate && endDate) {
      return new Date(startDate) < new Date(endDate)
    }
    return true
  },
  {
    message: 'End date must be after start date',
    path: ['endDate']
  }
)
export const BulkCreateSubjectsBodySchema = z.object({
  courseId: z.uuid(),
  subjects: z
    .array(CreateSubjectBodySchema.omit({ courseId: true }))
    .min(1)
    .max(50)
})
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
export const UpdateSubjectBodySchema = CreateSubjectBodySchema.partial()

export const AssignTrainerBodySchema = z.object({
  trainerUserId: z.uuid(),
  roleInSubject: z.enum(SubjectInstructorRole)
})

export const AssignTrainerResSchema = z.object({
  trainer: UserSchema.pick({
    id: true,
    eid: true,
    firstName: true,
    middleName: true,
    lastName: true,
    email: true,
    phoneNumber: true,
    status: true
  }),
  subject: SubjectSchema.pick({
    id: true,
    code: true,
    name: true,
    status: true,
    startDate: true,
    endDate: true
  }),
  role: z.enum(SubjectInstructorRole),
  assignedAt: z.coerce.date()
})

export const UpdateTrainerAssignmentBodySchema = z.object({
  roleInSubject: z.enum(SubjectInstructorRole)
})

export const UpdateTrainerAssignmentResSchema = AssignTrainerResSchema

export const LookupTraineesBodySchema = z.object({
  traineesList: z
    .array(
      z
        .object({
          eid: z.string(),
          email: z.email()
        })
        .refine((data) => data.eid || data.email, {
          message: 'Either eid or email must be provided'
        })
    )
    .min(1)
})
export const LookupTraineesResSchema = UserLookupResSchema

const TraineeUserIdsSchema = z
  .array(z.uuid())
  .min(1)
  .superRefine((ids, ctx) => {
    const seen = new Map<string, number>()

    ids.forEach((id, index) => {
      const firstIndex = seen.get(id)

      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate traineeUserId "${id}"`,
          path: [index]
        })
        return
      }

      seen.set(id, index)
    })
  })

export const AssignTraineesBodySchema = z.object({
  batchCode: z.string().min(1),
  traineeUserIds: TraineeUserIdsSchema
})

export type GetSubjectsQueryType = z.infer<typeof GetSubjectsQuerySchema>
export type GetSubjectsType = z.infer<typeof GetSubjectsSchema>
export type GetSubjectsResType = z.infer<typeof GetSubjectsResSchema>
export type GetSubjectDetailResType = z.infer<typeof GetSubjectDetailResSchema>
export type AvailableTrainerType = z.infer<typeof AvailableTrainerSchema>
export type GetAvailableTrainersResType = z.infer<typeof GetAvailableTrainersResSchema>
export type SubjectTrainerParamsType = z.infer<typeof SubjectTrainerParamsSchema>
export type SubjectTraineeParamsType = z.infer<typeof SubjectTraineeParamsSchema>
export type CreateSubjectBodyType = z.infer<typeof CreateSubjectBodySchema>
export type BulkCreateSubjectsBodyType = z.infer<typeof BulkCreateSubjectsBodySchema>
export type BulkCreateSubjectsResType = z.infer<typeof BulkCreateSubjectsResSchema>
export type UpdateSubjectBodyType = z.infer<typeof UpdateSubjectBodySchema>
export type AssignTrainerBodyType = z.infer<typeof AssignTrainerBodySchema>
export type AssignTrainerResType = z.infer<typeof AssignTrainerResSchema>
export type UpdateTrainerAssignmentResType = z.infer<typeof UpdateTrainerAssignmentResSchema>
export type LookupTraineesBodyType = z.infer<typeof LookupTraineesBodySchema>
export type LookupTraineesResType = z.infer<typeof LookupTraineesResSchema>
export type AssignTraineesBodyType = z.infer<typeof AssignTraineesBodySchema>
export type AssignTraineesResType = z.infer<typeof AssignTraineesResSchema>

export // Export types cho các schema con
type SubjectDetailInstructorType = z.infer<typeof SubjectDetailInstructorSchema>
export type SubjectDetailTraineeType = z.infer<typeof SubjectDetailTraineeSchema>
export type SubjectDetailEnrollmentsByBatchType = z.infer<typeof SubjectDetailEnrollmentsByBatchSchema>
export type SubjectDetailCourseType = z.infer<typeof SubjectDetailCourseSchema>

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
  id: z.uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  roleInSubject: z.nativeEnum(SubjectInstructorRole),
  assignedAt: z.iso.datetime().transform((value) => new Date(value))
})

// Enrollment info schema (simplified for response)
export const SubjectEnrollmentSchema = z.object({
  id: z.string().uuid(),
  eid: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  enrollmentDate: z.iso.datetime().transform((value) => new Date(value)),
  batchCode: z.string(),
  status: z.nativeEnum(SubjectEnrollmentStatus)
})

// Subject with relations including user info (for internal use)
export const SubjectWithUserInfoSchema = SubjectSchema.extend({
  course: SubjectCourseSchema.optional(),
  instructors: z.array(SubjectInstructorSchema).optional().default([]),
  enrollments: z.array(SubjectEnrollmentSchema).optional().default([]),
  instructorCount: z.number().int().default(0),
  enrollmentCount: z.number().int().default(0)
})

// Create Subject Body Schema

// Update Subject Body Schema - includes status field
// Note: duration is omitted from input but will be calculated internally

// Bulk Create Subjects Body Schema

// Bulk Create Subjects Response Schema

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

export type SubjectWithUserInfoType = z.infer<typeof SubjectWithUserInfoSchema>

export type AddInstructorsBodyType = z.infer<typeof AddInstructorsBodySchema>
export type RemoveInstructorsBodyType = z.infer<typeof RemoveInstructorsBodySchema>
export type EnrollTraineesBodyType = z.infer<typeof EnrollTraineesBodySchema>
export type RemoveEnrollmentsBodyType = z.infer<typeof RemoveEnrollmentsBodySchema>
export type UpdateEnrollmentStatusBodyType = z.infer<typeof UpdateEnrollmentStatusBodySchema>
export type BatchAddTraineesToCourseBodyType = z.infer<typeof BatchAddTraineesToCourseBodySchema>
export type BatchAddTraineesToSubjectBodyType = z.infer<typeof BatchAddTraineesToSubjectBodySchema>
export type SubjectStatsType = z.infer<typeof SubjectStatsSchema>
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

// ========================================
// TRAINEE ASSIGNMENT SCHEMAS & DTOs
// ========================================

// Lookup Trainees Schema

// Assign Trainees Schema

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

// Cancel Course Enrollments Schema

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

export const TraineeEnrollmentSubjectSchema = z.object({
  id: z.uuid(),
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

// Cancel Subject Enrollment Schema
export const CancelSubjectEnrollmentBodySchema = z.object({
  batchCode: z.string().min(1)
})

export const CancelSubjectEnrollmentResSchema = z.object({
  message: z.string()
})

// Type exports

export type UpdateTrainerAssignmentBodyType = z.infer<typeof UpdateTrainerAssignmentBodySchema>
export type TraineeAssignmentUserType = z.infer<typeof TraineeAssignmentUserSchema>
export type TraineeAssignmentDuplicateType = z.infer<typeof TraineeAssignmentDuplicateSchema>
export type TraineeAssignmentIssueType = z.infer<typeof TraineeAssignmentIssueSchema>

export type CancelCourseEnrollmentsResType = z.infer<typeof CancelCourseEnrollmentsResSchema>
export type GetTraineeEnrollmentsQueryType = z.infer<typeof GetTraineeEnrollmentsQuerySchema>
export type TraineeEnrollmentSubjectType = z.infer<typeof TraineeEnrollmentSubjectSchema>
export type CancelSubjectEnrollmentBodyType = z.infer<typeof CancelSubjectEnrollmentBodySchema>
export type CancelSubjectEnrollmentResType = z.infer<typeof CancelSubjectEnrollmentResSchema>

// DTO exports
