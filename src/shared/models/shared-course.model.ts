import z from 'zod'
import { CourseStatus, LevelStatus } from '~/shared/constants/course.constant'

export const CourseSchema = z.object({
  id: z.uuid(),
  departmentId: z.uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  code: z.string().min(1).max(20),
  maxNumTrainee: z.number().int().positive(),
  venue: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  passScore: z.number().min(0).max(100).optional().nullable(),
  startDate: z.iso.datetime().transform((d) => new Date(d)),
  endDate: z.iso.datetime().transform((d) => new Date(d)),
  level: z.enum(LevelStatus),
  status: z.enum(CourseStatus).default('PLANNED'),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d))
})
