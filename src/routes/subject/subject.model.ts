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
  roleInSubject: z.enum(SubjectInstructorRole)
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

export const SubjectEnrollmentBatchSummarySchema = z.object({
  batchCode: z.string(),
  totalTrainees: z.number().int(),
  activeTrainees: z.number().int(),
  statusCounts: z.object({
    ENROLLED: z.number().int().default(0),
    ON_GOING: z.number().int().default(0),
    CANCELLED: z.number().int().default(0),
    FINISHED: z.number().int().default(0)
  })
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

export const GetSubjectEnrollmentBatchesResSchema = z.object({
  subjectId: z.uuid(),
  batches: z.array(SubjectEnrollmentBatchSummarySchema)
})

export const AvailableTrainerSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  lastName: true,
  email: true,
  departmentId: true
}).extend({
  belongsToDepartment: z.boolean()
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

export const TraineeIdParamsSchema = z.object({
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
  role: z.enum(SubjectInstructorRole)
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

export const CancelSubjectEnrollmentBodySchema = z.object({
  batchCode: z.string().min(1)
})

export const SubjectBatchParamsSchema = SubjectIdParamsSchema.extend({
  batchCode: z.string().min(1)
})

export const RemoveEnrollmentsByBatchResSchema = z.object({
  batchCode: z.string(),
  removedCount: z.number().int(),
  removedTraineeEids: z.array(z.string()),
  message: z.string()
})

export const RemoveCourseTraineeEnrollmentsBodySchema = z.object({
  traineeEid: z.string().min(1),
  courseCode: z.string().min(1)
})

export const RemoveCourseTraineeEnrollmentsResSchema = z.object({
  message: z.string(),
  removedEnrollmentsCount: z.number().int(),
  affectedSubjectCodes: z.array(z.string())
})

export type GetSubjectsQueryType = z.infer<typeof GetSubjectsQuerySchema>
export type GetSubjectsType = z.infer<typeof GetSubjectsSchema>
export type GetSubjectsResType = z.infer<typeof GetSubjectsResSchema>
export type GetSubjectDetailResType = z.infer<typeof GetSubjectDetailResSchema>
export type AvailableTrainerType = z.infer<typeof AvailableTrainerSchema>
export type GetAvailableTrainersResType = z.infer<typeof GetAvailableTrainersResSchema>
export type SubjectTrainerParamsType = z.infer<typeof SubjectTrainerParamsSchema>
export type SubjectTraineeParamsType = z.infer<typeof SubjectTraineeParamsSchema>
export type TraineeIdParamsType = z.infer<typeof TraineeIdParamsSchema>
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
export type CancelSubjectEnrollmentBodyType = z.infer<typeof CancelSubjectEnrollmentBodySchema>
export type GetSubjectEnrollmentBatchesResType = z.infer<typeof GetSubjectEnrollmentBatchesResSchema>
export type SubjectBatchParamsType = z.infer<typeof SubjectBatchParamsSchema>
export type RemoveEnrollmentsByBatchResType = z.infer<typeof RemoveEnrollmentsByBatchResSchema>
export type RemoveCourseTraineeEnrollmentsBodyType = z.infer<typeof RemoveCourseTraineeEnrollmentsBodySchema>
export type RemoveCourseTraineeEnrollmentsResType = z.infer<typeof RemoveCourseTraineeEnrollmentsResSchema>

export // Export types cho các schema con
type SubjectDetailInstructorType = z.infer<typeof SubjectDetailInstructorSchema>
export type SubjectDetailTraineeType = z.infer<typeof SubjectDetailTraineeSchema>
export type SubjectDetailEnrollmentsByBatchType = z.infer<typeof SubjectDetailEnrollmentsByBatchSchema>
export type SubjectDetailCourseType = z.infer<typeof SubjectDetailCourseSchema>
export type SubjectEnrollmentBatchSummaryType = z.infer<typeof SubjectEnrollmentBatchSummarySchema>

// Remove Enrollments Body Schema
export const RemoveEnrollmentsBodySchema = z.object({
  traineeEids: z.array(z.string().min(1))
})

// Remove Enrollments Response Schema
export const RemoveEnrollmentsResSchema = z.object({
  success: z.boolean(),
  removedTrainees: z.array(z.string()),
  notFoundTrainees: z.array(z.string()),
  message: z.string()
})

export type RemoveEnrollmentsBodyType = z.infer<typeof RemoveEnrollmentsBodySchema>
export type RemoveEnrollmentsResType = z.infer<typeof RemoveEnrollmentsResSchema>

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

export const TraineeEnrollmentUserSchema = z.object({
  userId: z.uuid(),
  eid: z.string(),
  fullName: z.string(),
  email: z.email(),
  department: z
    .object({
      id: z.uuid(),
      name: z.string()
    })
    .nullable()
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

export const TraineeEnrollmentRecordSchema = z.object({
  subject: TraineeEnrollmentSubjectSchema,
  enrollment: z.object({
    batchCode: z.string(),
    status: z.enum(SubjectEnrollmentStatus),
    enrollmentDate: z.iso.datetime().transform((value) => new Date(value)),
    updatedAt: z.iso.datetime().transform((value) => new Date(value))
  })
})

export const GetTraineeEnrollmentsResSchema = z.object({
  trainee: TraineeEnrollmentUserSchema,
  enrollments: z.array(TraineeEnrollmentRecordSchema),
  totalCount: z.number().int()
})

export type TraineeAssignmentUserType = z.infer<typeof TraineeAssignmentUserSchema>
export type TraineeAssignmentDuplicateType = z.infer<typeof TraineeAssignmentDuplicateSchema>
export type TraineeAssignmentIssueType = z.infer<typeof TraineeAssignmentIssueSchema>

export type GetTraineeEnrollmentsQueryType = z.infer<typeof GetTraineeEnrollmentsQuerySchema>
export type TraineeEnrollmentUserType = z.infer<typeof TraineeEnrollmentUserSchema>
export type TraineeEnrollmentRecordType = z.infer<typeof TraineeEnrollmentRecordSchema>
export type GetTraineeEnrollmentsResType = z.infer<typeof GetTraineeEnrollmentsResSchema>
