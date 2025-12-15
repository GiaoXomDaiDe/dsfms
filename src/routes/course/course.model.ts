import { z } from 'zod'
import {
  GetTraineeEnrollmentsQuerySchema,
  SubjectDetailInstructorSchema,
  TraineeEnrollmentRecordSchema,
  TraineeEnrollmentSubjectSchema,
  TraineeEnrollmentUserSchema
} from '~/routes/subject/subject.model'
import { SubjectInstructorRole } from '~/shared/constants/subject.constant'
import { CourseIdParamsSchema, CourseIdParamsType, CourseSchema } from '~/shared/models/shared-course.model'
import { DepartmentSchema } from '~/shared/models/shared-department.model'
import { SubjectSchema } from '~/shared/models/shared-subject.model'
import { UserSchema } from '~/shared/models/shared-user.model'

// Core trainer representations ---------------------------------------------
const CourseExaminerTrainerSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  status: true
})

const CourseInstructorSchema = CourseExaminerTrainerSchema.extend({
  roleInCourse: z.array(z.enum(SubjectInstructorRole)).default([])
})

// Parameter schemas ---------------------------------------------------------
export const GetCourseParamsSchema = CourseIdParamsSchema

export const CourseTrainerParamsSchema = GetCourseParamsSchema.extend({
  trainerId: z.uuid()
})

// Course listing & detail ---------------------------------------------------
export const GetCoursesResSchema = z.object({
  courses: z.array(
    CourseSchema.extend({
      department: DepartmentSchema.pick({
        id: true,
        name: true,
        code: true,
        description: true
      }),
      totalSubjects: z.number().int().nonnegative().default(0)
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
  instructors: z.array(CourseInstructorSchema).default([]),
  subjects: z.array(
    SubjectSchema.omit({ courseId: true }).extend({
      instructors: z.array(SubjectDetailInstructorSchema).default([])
    })
  )
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

// Trainee aggregates --------------------------------------------------------
export const GetCourseTraineesQuerySchema = z.object({
  batchCode: z.string().optional()
})

export const CourseTraineeInfoSchema = UserSchema.pick({
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true
}).extend({
  subjectCount: z.number().int()
})

export const GetCourseTraineesResSchema = z.object({
  trainees: z.array(CourseTraineeInfoSchema),
  totalItems: z.number().int()
})

export const GetCourseTraineeEnrollmentsQuerySchema = GetTraineeEnrollmentsQuerySchema

const CourseTraineeSubjectEnrollmentSchema = z.object({
  subject: TraineeEnrollmentSubjectSchema,
  enrollment: TraineeEnrollmentRecordSchema.shape.enrollment
})

export const GetCourseTraineeEnrollmentsResSchema = z.object({
  courseId: z.uuid(),
  trainee: TraineeEnrollmentUserSchema,
  subjects: z.array(CourseTraineeSubjectEnrollmentSchema),
  totalSubjects: z.number().int()
})

// Trainer assignment --------------------------------------------------------
const CourseTrainerCourseSchema = CourseSchema.pick({
  id: true,
  code: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true
})

export const AssignCourseTrainerBodySchema = z.object({
  trainerUserId: z.uuid(),
  roleInSubject: z.enum(SubjectInstructorRole)
})

export const AssignCourseTrainerResSchema = z.object({
  trainer: CourseExaminerTrainerSchema,
  course: CourseTrainerCourseSchema,
  role: z.enum(SubjectInstructorRole)
})

export const UpdateCourseTrainerRoleBodySchema = z.object({
  roleInCourse: z.enum(SubjectInstructorRole)
})

export const UpdateCourseTrainerRoleResSchema = AssignCourseTrainerResSchema

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

export const GetCourseEnrollmentBatchesResSchema = z.object({
  courseId: z.uuid(),
  batches: z.array(CourseEnrollmentBatchSummarySchema)
})

export type CourseType = z.infer<typeof CourseSchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type GetCourseResType = z.infer<typeof GetCourseResSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type CreateCourseResType = z.infer<typeof CreateCourseResSchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type UpdateCourseResType = z.infer<typeof UpdateCourseResSchema>
export type CourseTrainerParamsType = z.infer<typeof CourseTrainerParamsSchema>
export type GetCourseParamsType = CourseIdParamsType
export type GetCourseTraineesQueryType = z.infer<typeof GetCourseTraineesQuerySchema>
export type CourseTraineeInfoType = z.infer<typeof CourseTraineeInfoSchema>
export type GetCourseTraineesResType = z.infer<typeof GetCourseTraineesResSchema>
export type GetCourseTraineeEnrollmentsQueryType = z.infer<typeof GetCourseTraineeEnrollmentsQuerySchema>
export type CourseTraineeSubjectEnrollmentType = z.infer<typeof CourseTraineeSubjectEnrollmentSchema>
export type GetCourseTraineeEnrollmentsResType = z.infer<typeof GetCourseTraineeEnrollmentsResSchema>
export type AssignCourseTrainerBodyType = z.infer<typeof AssignCourseTrainerBodySchema>
export type AssignCourseTrainerResType = z.infer<typeof AssignCourseTrainerResSchema>
export type UpdateCourseTrainerRoleBodyType = z.infer<typeof UpdateCourseTrainerRoleBodySchema>
export type UpdateCourseTrainerRoleResType = z.infer<typeof UpdateCourseTrainerRoleResSchema>
export type GetCourseEnrollmentBatchesResType = z.infer<typeof GetCourseEnrollmentBatchesResSchema>
export type CourseEnrollmentBatchSummaryType = z.infer<typeof CourseEnrollmentBatchSummarySchema>
