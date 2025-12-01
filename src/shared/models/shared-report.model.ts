import z from 'zod'
import { ReportSeverity, ReportStatus, ReportType } from '~/shared/constants/report.constant'
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
    ReportType.FEEDBACK,
    ReportType.COURSE_ORGANIZATION_REPORT,
    ReportType.FACILITIES_REPORT,
    ReportType.FATIGUE_REPORT,
    ReportType.INSTRUCTOR_REPORT,
    ReportType.TRAINING_PROGRAM_REPORT,
    ReportType.OTHER,
    ReportType.SAFETY_REPORT
  ]),
  createdById: z.uuid(),
  severity: z.enum(ReportSeverity).nullable(),
  title: z.string().max(255).nullable(),
  description: z.string().max(4000).nullable(),
  actionsTaken: z.string().max(2000).nullable(),
  isAnonymous: z.boolean().default(false),
  status: z.enum(ReportStatus),
  managedById: z.uuid().nullable(),
  response: z.string().max(4000).nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedById: z.uuid().nullable(),
  createdBy: reportUserSummarySchema,
  updatedBy: reportUserSummarySchema.nullable(),
  managedBy: reportUserSummarySchema.nullable()
})

export type ReportModel = z.infer<typeof ReportSchema>
