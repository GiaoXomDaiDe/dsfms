import { z } from 'zod'
import { SubjectInstructorRole } from '~/shared/constants/subject.constant'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'
import { CourseSchema } from '~/shared/models/shared-course.model'
import { DepartmentSchema } from '~/shared/models/shared-department.model'
import { SubjectSchema } from '~/shared/models/shared-subject.model'
import { UserSchema } from '~/shared/models/shared-user.model'

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

const CourseExaminerSubjectSchema = SubjectSchema.pick({
  id: true,
  courseId: true,
  code: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true
}).nullable()

export const GetCoursesQuerySchema = IncludeDeletedQuerySchema.strict()

export const GetCourseParamsSchema = z.object({
  courseId: z.uuid()
})

export const CourseTrainerParamsSchema = GetCourseParamsSchema.extend({
  trainerId: z.uuid()
})

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
  subjects: z.array(SubjectSchema.omit({ courseId: true })),
  courseExaminers: z.array(
    z.object({
      trainer: CourseExaminerTrainerSchema,
      role: z.enum(SubjectInstructorRole),
      scope: z.enum(['COURSE', 'SUBJECT', 'COURSE_AND_SUBJECT', 'CROSS_SUBJECT']),
      subject: CourseExaminerSubjectSchema,
      assignedAt: z.coerce.date().or(z.null())
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

export const AssignCourseExaminerBodySchema = z.object({
  trainerUserId: z.uuid(),
  roleInSubject: z.enum(SubjectInstructorRole),
  subjectId: z.uuid().optional()
})

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

export const UpdateCourseTrainerAssignmentBodySchema = z.object({
  roleInSubject: z.enum(SubjectInstructorRole)
})

export const UpdateCourseTrainerAssignmentResSchema = AssignCourseTrainerResSchema

const CourseExaminerCourseSchema = CourseSchema.pick({
  id: true,
  code: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true
})

export const CourseExaminerAssignmentSchema = z.object({
  trainer: CourseExaminerTrainerSchema,
  course: CourseExaminerCourseSchema,
  subject: CourseExaminerSubjectSchema,
  role: z.enum(SubjectInstructorRole),
  assignedAt: z.coerce.date()
})

export const AssignCourseExaminerResSchema = z.object({
  message: z.string(),
  data: CourseExaminerAssignmentSchema
})

export type CourseType = z.infer<typeof CourseSchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type GetCourseResType = z.infer<typeof GetCourseResSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type CreateCourseResType = z.infer<typeof CreateCourseResSchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type UpdateCourseResType = z.infer<typeof UpdateCourseResSchema>
export type CourseTrainerParamsType = z.infer<typeof CourseTrainerParamsSchema>
export type GetCourseParamsType = z.infer<typeof GetCourseParamsSchema>
export type GetCoursesQueryType = z.infer<typeof GetCoursesQuerySchema>
export type GetCourseTraineesQueryType = z.infer<typeof GetCourseTraineesQuerySchema>
export type CourseTraineeInfoType = z.infer<typeof CourseTraineeInfoSchema>
export type GetCourseTraineesResType = z.infer<typeof GetCourseTraineesResSchema>
export type AssignCourseTrainerBodyType = z.infer<typeof AssignCourseTrainerBodySchema>
export type AssignCourseTrainerResType = z.infer<typeof AssignCourseTrainerResSchema>
export type UpdateCourseTrainerAssignmentBodyType = z.infer<typeof UpdateCourseTrainerAssignmentBodySchema>
export type UpdateCourseTrainerAssignmentResType = z.infer<typeof UpdateCourseTrainerAssignmentResSchema>
export type AssignCourseExaminerBodyType = z.infer<typeof AssignCourseExaminerBodySchema>
export type CourseExaminerAssignmentType = z.infer<typeof CourseExaminerAssignmentSchema>
export type AssignCourseExaminerResType = z.infer<typeof AssignCourseExaminerResSchema>
