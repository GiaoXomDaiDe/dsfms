import z from 'zod'
import { RequestSeverity, RequestStatus, RequestType } from '~/shared/constants/report.constant'

export const ReportSchema = z.object({
  id: z.uuid(),
  requestType: z.enum([
    RequestType.ASSESSMENT_APPROVAL_REQUEST,
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
  assessmentId: z.uuid().nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedById: z.uuid().nullable()
})
