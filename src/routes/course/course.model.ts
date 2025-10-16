import { SubjectEnrollmentStatus } from '@prisma/client'
import { z } from 'zod'
import { TraineeEnrollmentSubjectSchema } from '~/routes/subject/subject.model'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'
import { CourseSchema } from '~/shared/models/shared-course.model'
import { DepartmentSchema } from '~/shared/models/shared-department.model'
import { SubjectSchema } from '~/shared/models/shared-subject.model'
import { UserSchema } from '~/shared/models/shared-user.model'

export const GetCoursesQuerySchema = IncludeDeletedQuerySchema.strict()

export const GetCourseParamsSchema = z.object({
  courseId: z.uuid()
})

export const GetCoursesResSchema = z.object({
  courses: z.array(
    CourseSchema.extend({
      department: DepartmentSchema.pick({
        id: true,
        name: true,
        code: true,
        description: true
      })
    })
  ),
  totalItems: z.number()
})

export const GetCourseResSchema = CourseSchema.extend({
  department: DepartmentSchema.pick({
    id: true,
    name: true,
    code: true,
    description: true
  }),
  subjectCount: z.number().int().default(0),
  traineeCount: z.number().int().default(0),
  trainerCount: z.number().int().default(0),
  subjects: z.array(SubjectSchema.omit({ courseId: true }))
})

export const CreateCourseBodySchema = CourseSchema.pick({
  departmentId: true,
  name: true,
  description: true,
  code: true,
  maxNumTrainee: true,
  venue: true,
  note: true,
  passScore: true,
  startDate: true,
  endDate: true,
  level: true,
  status: true
}).refine(
  (data) => {
    return new Date(data.startDate) < new Date(data.endDate)
  },
  {
    message: 'End date must be after start date',
    path: ['endDate']
  }
)

export const CreateCourseResSchema = CourseSchema.extend({
  department: DepartmentSchema.pick({
    id: true,
    name: true,
    code: true,
    description: true
  })
}).omit({ departmentId: true })

export const UpdateCourseBodySchema = CreateCourseBodySchema.partial()

export const UpdateCourseResSchema = CreateCourseResSchema

export const GetCourseTraineesQuerySchema = z.object({
  batchCode: z.string().optional()
})

export const CourseTraineeInfoSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  lastName: true,
  email: true
}).extend({
  enrollmentCount: z.number().int(),
  batches: z.array(z.string())
})

export const GetCourseTraineesResSchema = z.object({
  trainees: z.array(CourseTraineeInfoSchema),
  totalItems: z.number().int()
})

export const CancelCourseEnrollmentsBodySchema = z.object({
  batchCode: z.string().min(1)
})

export const TraineeEnrollmentUserSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true
}).extend({
  department: DepartmentSchema.pick({
    id: true,
    name: true,
    code: true,
    description: true
  }).nullable()
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

export type CourseType = z.infer<typeof CourseSchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type GetCourseResType = z.infer<typeof GetCourseResSchema>
export type CourseListItemType = z.infer<typeof CourseListItemSchema>
export type CourseWithInfoType = z.infer<typeof CourseWithInfoSchema>
export type CourseDetailResType = z.infer<typeof CourseDetailResSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type CreateCourseResType = z.infer<typeof CreateCourseResSchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type UpdateCourseResType = z.infer<typeof UpdateCourseResSchema>
export type GetCourseParamsType = z.infer<typeof GetCourseParamsSchema>
export type GetCoursesQueryType = z.infer<typeof GetCoursesQuerySchema>
export type GetCourseTraineesQueryType = z.infer<typeof GetCourseTraineesQuerySchema>
export type CourseTraineeInfoType = z.infer<typeof CourseTraineeInfoSchema>
export type GetCourseTraineesResType = z.infer<typeof GetCourseTraineesResSchema>
export type CourseStatsType = z.infer<typeof CourseStatsSchema>
export type RemoveSubjectFromCourseBodyType = z.infer<typeof RemoveSubjectFromCourseBodySchema>
export type RemoveSubjectFromCourseResType = z.infer<typeof RemoveSubjectFromCourseResSchema>
