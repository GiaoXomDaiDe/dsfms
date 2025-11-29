import z from 'zod'
import { SubjectInstructorRole } from '~/shared/constants/subject.constant'
import {
  isoDateSchema,
  isoDatetimeSchema,
  nullableStringField,
  nullableUuidSchema
} from '~/shared/helpers/zod-validation.helper'
import {
  courseCodeSchema,
  courseLevelSchema,
  courseNameSchema,
  coursePassScoreSchema,
  courseStatusSchema
} from '~/shared/validation/course.validation'

export const CourseSchema = z.object({
  id: z.uuid(),
  departmentId: z.uuid(),
  name: courseNameSchema,
  description: nullableStringField(z.string()),
  code: courseCodeSchema,
  maxNumTrainee: z.number().int().positive(),
  venue: nullableStringField(z.string()),
  note: nullableStringField(z.string()),
  passScore: coursePassScoreSchema.optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  level: courseLevelSchema,
  status: courseStatusSchema.default('PLANNED'),
  createdById: nullableUuidSchema,
  updatedById: nullableUuidSchema,
  deletedById: nullableUuidSchema,
  deletedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema
})

export const TeachingCourseSchema = CourseSchema.pick({
  id: true,
  code: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true
}).extend({
  role: z.enum(SubjectInstructorRole)
})

export const CourseIdParamsSchema = z.object({
  courseId: z.uuid()
})

export type CourseType = z.infer<typeof CourseSchema>
export type TeachingCourseType = z.infer<typeof TeachingCourseSchema>
export type CourseIdParamsType = string
