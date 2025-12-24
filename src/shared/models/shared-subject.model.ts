import z from 'zod'
import { isoDateSchema, isoDatetimeSchema } from '~/shared/helpers/zod-validation.helper'
import {
  subjectCodeSchema,
  subjectDescriptionSchema,
  subjectDurationSchema,
  subjectInstructorRoleSchema,
  subjectMethodSchema,
  subjectNameSchema,
  subjectPassScoreSchema,
  subjectRemarkSchema,
  subjectRoomNameSchema,
  subjectStatusSchema,
  subjectTimeSlotSchema,
  subjectTypeSchema
} from '~/shared/validation/subject.validation'

export const SubjectSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  name: subjectNameSchema,
  code: subjectCodeSchema,
  description: subjectDescriptionSchema,
  method: subjectMethodSchema,
  duration: subjectDurationSchema,
  type: subjectTypeSchema,
  roomName: subjectRoomNameSchema,
  remarkNote: subjectRemarkSchema,
  timeSlot: subjectTimeSlotSchema,
  passScore: subjectPassScoreSchema,
  isSIM: z.boolean().default(false),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  status: subjectStatusSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  deletedAt: isoDatetimeSchema.nullable()
})

export const SubjectIdParamsSchema = z.object({
  subjectId: z.uuid()
})

export const TeachingSubjectSchema = SubjectSchema.pick({
  id: true,
  courseId: true,
  code: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true
}).extend({
  role: subjectInstructorRoleSchema
})

export type SubjectType = z.infer<typeof SubjectSchema>
export type TeachingSubjectType = z.infer<typeof TeachingSubjectSchema>
export type SubjectIdParamsType = string
