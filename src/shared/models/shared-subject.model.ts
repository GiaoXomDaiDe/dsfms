import { Prisma, SubjectMethod, SubjectStatus, SubjectType } from '@prisma/client'
import z from 'zod'

export const SubjectSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  method: z.enum(SubjectMethod),
  // duration can be fractional (hours), store as decimal with 2dp in DB
  // accept numbers or numeric strings; coerce to number and validate positive
  duration: z.instanceof(Prisma.Decimal).optional().nullable(),
  type: z.nativeEnum(SubjectType),
  roomName: z.string().optional().nullable(),
  remarkNote: z.string().optional().nullable(),
  timeSlot: z.string().optional().nullable(),
  isSIM: z.boolean(),
  passScore: z.number().min(0).max(100).optional().nullable(),
  startDate: z.iso.datetime().transform((value) => new Date(value)),
  status: z.nativeEnum(SubjectStatus),
  endDate: z.iso.datetime().transform((value) => new Date(value)),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d)),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable()
})
