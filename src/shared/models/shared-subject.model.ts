import z from 'zod'
import { SubjectMethod, SubjectStatus, SubjectType } from '~/shared/constants/subject.constant'

export const SubjectSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  method: z.enum([SubjectMethod.CLASSROOM, SubjectMethod.ERO, SubjectMethod.E_LEARNING]),
  duration: z.number().optional().nullable(),
  type: z.enum([SubjectType.RECURRENT, SubjectType.UNLIMIT]),
  roomName: z.string().optional().nullable(),
  remarkNote: z.string().optional().nullable(),
  timeSlot: z.string().optional().nullable(),
  isSIM: z.boolean(),
  passScore: z.number().min(0).max(100).optional().nullable(),
  startDate: z.iso.datetime().transform((d) => new Date(d)),
  endDate: z.iso.datetime().transform((d) => new Date(d)),
  status: z.enum([SubjectStatus.ARCHIVED, SubjectStatus.PLANNED, SubjectStatus.ON_GOING, SubjectStatus.COMPLETED]),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d)),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable()
})

export const SubjectIdParamsSchema = z.object({
  subjectId: z.uuid()
})

export type SubjectType = z.infer<typeof SubjectSchema>
export type SubjectIdParamsType = string
