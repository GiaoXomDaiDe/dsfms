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
  status: true,
  email: true,
  phoneNumber: true
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
  enrollmentStatus: z.enum(SubjectEnrollmentStatus)
})

// Schema cho batch enrollments
export const SubjectDetailEnrollmentsByBatchSchema = z.object({
  batchCode: z.string(),
  trainees: z.array(SubjectDetailTraineeSchema)
})

const StatusCountSchema = z.object({
  ENROLLED: z.number().int().default(0),
  ON_GOING: z.number().int().default(0),
  CANCELLED: z.number().int().default(0),
  FINISHED: z.number().int().default(0)
})

export const CourseEnrollmentBatchSubjectSchema = z.object({
  subjectId: z.uuid(),
  subjectCode: z.string(),
  subjectName: z.string(),
  totalTrainees: z.number().int(),
  activeTrainees: z.number().int(),
  statusCounts: StatusCountSchema
})

export const CourseEnrollmentBatchSummarySchema = z.object({
  batchCode: z.string(),
  totalTrainees: z.number().int(),
  activeTrainees: z.number().int(),
  statusCounts: StatusCountSchema,
  subjects: z.array(CourseEnrollmentBatchSubjectSchema)
})

// Schema cho course trong subject detail
export const SubjectDetailCourseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    code: z.string(),
    status: z.enum(CourseStatus),
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

export const GetCourseEnrollmentBatchesResSchema = z.object({
  courseId: z.uuid(),
  batches: z.array(CourseEnrollmentBatchSummarySchema)
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

const enrollmentSortFields = ['enrollmentDate', 'courseCode', 'subjectCode', 'traineeEid'] as const
const sortOrderValues = ['asc', 'desc'] as const

export const GetEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  courseId: z.uuid().optional(),
  courseCode: z.string().optional(),
  subjectId: z.uuid().optional(),
  subjectCode: z.string().optional(),
  traineeId: z.uuid().optional(),
  traineeEid: z.string().optional(),
  traineeEmail: z.email().optional(),
  batchCode: z.string().optional(),
  status: z.enum(SubjectEnrollmentStatus).optional(),
  enrollmentDateFrom: z.iso.datetime().optional(),
  enrollmentDateTo: z.iso.datetime().optional(),
  sortBy: z.enum(enrollmentSortFields).default('enrollmentDate'),
  sortOrder: z.enum(sortOrderValues).default('desc')
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

export const CourseBatchParamsSchema = z.object({
  courseId: z.uuid(),
  batchCode: z.string().min(1)
})

export const RemoveCourseEnrollmentsByBatchResSchema = z.object({
  courseId: z.uuid(),
  batchCode: z.string(),
  removedCount: z.number().int(),
  removedSubjects: z.array(
    z.object({
      subjectId: z.uuid(),
      subjectCode: z.string(),
      subjectName: z.string(),
      removedCount: z.number().int(),
      removedTraineeEids: z.array(z.string())
    })
  ),
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
export type GetAvailableTrainersResType = z.infer<typeof GetAvailableTrainersResSchema>
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
export type GetEnrollmentsQueryType = z.infer<typeof GetEnrollmentsQuerySchema>
export type EnrollmentTraineeType = z.infer<typeof EnrollmentTraineeSchema>
export type EnrollmentCourseType = z.infer<typeof EnrollmentCourseSchema>
export type EnrollmentSubjectType = z.infer<typeof EnrollmentSubjectSchema>
export type EnrollmentRecordType = z.infer<typeof EnrollmentRecordSchema>
export type EnrollmentListItemType = z.infer<typeof EnrollmentListItemSchema>
export type GetEnrollmentsResType = z.infer<typeof GetEnrollmentsResSchema>
export type GetSubjectEnrollmentsQueryType = z.infer<typeof GetSubjectEnrollmentsQuerySchema>
export type SubjectEnrollmentSummaryType = z.infer<typeof SubjectEnrollmentSummarySchema>
export type SubjectEnrollmentListItemType = z.infer<typeof SubjectEnrollmentListItemSchema>
export type GetSubjectEnrollmentsResType = z.infer<typeof GetSubjectEnrollmentsResSchema>
export type GetCourseEnrollmentBatchesResType = z.infer<typeof GetCourseEnrollmentBatchesResSchema>
export type RemoveCourseEnrollmentsByBatchResType = z.infer<typeof RemoveCourseEnrollmentsByBatchResSchema>
export type RemoveCourseTraineeEnrollmentsBodyType = z.infer<typeof RemoveCourseTraineeEnrollmentsBodySchema>
export type RemoveCourseTraineeEnrollmentsResType = z.infer<typeof RemoveCourseTraineeEnrollmentsResSchema>

// Export types cho các schema con
export type SubjectDetailInstructorType = z.infer<typeof SubjectDetailInstructorSchema>
export type SubjectDetailTraineeType = z.infer<typeof SubjectDetailTraineeSchema>
export type SubjectDetailEnrollmentsByBatchType = z.infer<typeof SubjectDetailEnrollmentsByBatchSchema>
export type SubjectDetailCourseType = z.infer<typeof SubjectDetailCourseSchema>
export type CourseEnrollmentBatchSummaryType = z.infer<typeof CourseEnrollmentBatchSummarySchema>

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
    id: z.uuid(),
    name: z.string()
  })
  .nullable()

export const TraineeAssignmentUserSchema = z.object({
  userId: z.uuid(),
  eid: z.string(),
  fullName: z.string(),
  email: z.email(),
  department: TraineeAssignmentDepartmentSchema
})

export const TraineeAssignmentDuplicateSchema = TraineeAssignmentUserSchema.extend({
  enrolledAt: z.iso.datetime(),
  batchCode: z.string()
})

export const TraineeAssignmentIssueSchema = z.object({
  submittedId: z.uuid(),
  eid: z.string().optional(),
  email: z.email().optional(),
  reason: z.enum(['USER_NOT_FOUND', 'ROLE_NOT_TRAINEE', 'USER_INACTIVE']),
  note: z.string().optional()
})

export const AssignTraineesResSchema = z.object({
  enrolledCount: z.number().int(),
  enrolled: z.array(TraineeAssignmentUserSchema)
})

const EnrollmentDepartmentSchema = TraineeAssignmentDepartmentSchema

export const EnrollmentTraineeSchema = z.object({
  id: z.uuid(),
  eid: z.string(),
  fullName: z.string(),
  email: z.email(),
  department: EnrollmentDepartmentSchema
})

export const EnrollmentCourseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(CourseStatus)
})

export const EnrollmentSubjectSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(SubjectStatus),
  method: z.enum(SubjectMethod),
  type: z.enum(SubjectType)
})

export const EnrollmentRecordSchema = z.object({
  status: z.enum(SubjectEnrollmentStatus),
  batchCode: z.string(),
  enrollmentDate: z.date(),
  updatedAt: z.date()
})

export const EnrollmentListItemSchema = z.object({
  trainee: EnrollmentTraineeSchema,
  course: EnrollmentCourseSchema.nullable(),
  subject: EnrollmentSubjectSchema,
  enrollment: EnrollmentRecordSchema
})

export const GetEnrollmentsResSchema = z.object({
  items: z.array(EnrollmentListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int()
})

export const GetSubjectEnrollmentsQuerySchema = z.object({
  batchCode: z.string().optional(),
  status: z.enum(SubjectEnrollmentStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

export const SubjectEnrollmentSummarySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(SubjectStatus),
  method: z.enum(SubjectMethod),
  type: z.enum(SubjectType),
  course: z
    .object({
      id: z.uuid(),
      code: z.string(),
      name: z.string(),
      status: z.enum(CourseStatus)
    })
    .nullable()
})

export const SubjectEnrollmentListItemSchema = z.object({
  trainee: EnrollmentTraineeSchema,
  enrollment: EnrollmentRecordSchema
})

export const GetSubjectEnrollmentsResSchema = z.object({
  subject: SubjectEnrollmentSummarySchema,
  items: z.array(SubjectEnrollmentListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalItems: z.number().int()
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
  status: z.enum(SubjectEnrollmentStatus).optional()
})

export const TraineeEnrollmentUserSchema = TraineeAssignmentUserSchema

export const TraineeEnrollmentSubjectSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(SubjectStatus),
  type: z.enum(SubjectType),
  method: z.enum(SubjectMethod),
  startDate: z.iso.datetime().nullable(),
  endDate: z.iso.datetime().nullable(),
  course: z
    .object({
      id: z.uuid(),
      name: z.string()
    })
    .nullable()
})

export const TraineeEnrollmentRecordSchema = z.object({
  subject: TraineeEnrollmentSubjectSchema,
  enrollment: z.object({
    batchCode: z.string(),
    status: z.enum(SubjectEnrollmentStatus),
    enrollmentDate: z.iso
      .datetime()
      .transform((d) => new Date(d))
      .nullable(),
    updatedAt: z.iso
      .datetime()
      .transform((d) => new Date(d))
      .nullable()
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
