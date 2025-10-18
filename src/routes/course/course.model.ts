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
    status: z.enum(SubjectEnrollmentStatus),
    enrollmentDate: z.iso.datetime().transform((d) => new Date(d)),
    updatedAt: z.iso.datetime().transform((d) => new Date(d))
  })
})

export const GetTraineeEnrollmentsResSchema = z.object({
  trainee: TraineeEnrollmentUserSchema,
  enrollments: z.array(TraineeEnrollmentRecordSchema),
  totalCount: z.number().int()
})

export type CourseType = z.infer<typeof CourseSchema>
export type GetCoursesResType = z.infer<typeof GetCoursesResSchema>
export type GetCourseResType = z.infer<typeof GetCourseResSchema>
export type CreateCourseBodyType = z.infer<typeof CreateCourseBodySchema>
export type CreateCourseResType = z.infer<typeof CreateCourseResSchema>
export type UpdateCourseBodyType = z.infer<typeof UpdateCourseBodySchema>
export type UpdateCourseResType = z.infer<typeof UpdateCourseResSchema>
export type GetCourseParamsType = z.infer<typeof GetCourseParamsSchema>
export type GetCoursesQueryType = z.infer<typeof GetCoursesQuerySchema>
export type GetCourseTraineesQueryType = z.infer<typeof GetCourseTraineesQuerySchema>
export type CourseTraineeInfoType = z.infer<typeof CourseTraineeInfoSchema>
export type GetCourseTraineesResType = z.infer<typeof GetCourseTraineesResSchema>
