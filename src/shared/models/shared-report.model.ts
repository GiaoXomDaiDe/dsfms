import z from 'zod'
import { RequestSeverity, RequestStatus, RequestType } from '~/shared/constants/report.constant'
import { userNameSchema } from '~/shared/validation/user.validation'

const reportUserSummarySchema = z.object({
  id: z.uuid(),
  firstName: userNameSchema,
  lastName: userNameSchema,
  email: z.email().max(255),
  role: z.object({
    name: z.string().max(100)
  })
})

export const ReportSchema = z.object({
  id: z.uuid(),
  requestType: z.enum([
    RequestType.FEEDBACK,
    RequestType.COURSE_ORGANIZATION_REPORT,
    RequestType.FACILITIES_REPORT,
    RequestType.FATIGUE_REPORT,
    RequestType.INSTRUCTOR_REPORT,
    RequestType.TRAINING_PROGRAM_REPORT,
    RequestType.OTHER,
    RequestType.SAFETY_REPORT
  ]),
  createdById: z.uuid(),
  severity: z.enum(RequestSeverity).nullable(),
  title: z.string().max(255).nullable(),
  description: z.string().max(4000).nullable(),
  actionsTaken: z.string().max(2000).nullable(),
  isAnonymous: z.boolean().default(false),
  status: z.enum(RequestStatus),
  managedById: z.uuid().nullable(),
  response: z.string().max(4000).nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedById: z.uuid().nullable(),
  createdBy: reportUserSummarySchema,
  updatedBy: reportUserSummarySchema.nullable(),
  managedBy: reportUserSummarySchema.nullable()
})

export type ReportType = z.infer<typeof ReportSchema>
