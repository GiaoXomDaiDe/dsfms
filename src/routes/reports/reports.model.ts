import { z } from 'zod'
import type { ReportTypeValue } from '~/shared/constants/report.constant'
import { ReportSeverity, ReportStatus, ReportType } from '~/shared/constants/report.constant'
import { ReportSchema } from '~/shared/models/shared-report.model'

export const REQUEST_TYPE_FILTER_MAP: Record<'INCIDENT' | 'FEEDBACK', ReportTypeValue[]> = {
  INCIDENT: [
    ReportType.SAFETY_REPORT,
    ReportType.INSTRUCTOR_REPORT,
    ReportType.FATIGUE_REPORT,
    ReportType.TRAINING_PROGRAM_REPORT,
    ReportType.FACILITIES_REPORT,
    ReportType.COURSE_ORGANIZATION_REPORT
  ],
  FEEDBACK: [ReportType.FEEDBACK]
}

export const GetReportsQuerySchema = z
  .object({
    requestType: z
      .enum(['INCIDENT', 'FEEDBACK'])
      .optional()
      .transform((value) => (value ? REQUEST_TYPE_FILTER_MAP[value] : undefined)),
    status: z.enum(ReportStatus).optional(),
    severity: z.enum(ReportSeverity).optional(),
    isAnonymous: z.coerce.boolean().optional()
  })
  .strict()

export const GetReportsResSchema = z.object({
  reports: z.array(ReportSchema),
  totalItems: z.number().int()
})

export const GetMyReportsResSchema = GetReportsResSchema

export const GetReportResSchema = ReportSchema

export const GetReportParamsSchema = z
  .object({
    reportId: z.uuid()
  })
  .strict()

export const CreateReportBodySchema = ReportSchema.pick({
  isAnonymous: true,
  requestType: true,
  severity: true,
  title: true,
  description: true,
  actionsTaken: true
}).extend({
  // Override isAnonymous to be optional with default false
  isAnonymous: z.boolean().optional().default(false)
})

export const CreateReportResSchema = ReportSchema

export const CancelReportParamsSchema = GetReportParamsSchema

export const CancelReportResSchema = ReportSchema

export const AcknowledgeReportParamsSchema = CancelReportParamsSchema

export const AcknowledgeReportResSchema = ReportSchema

export const RespondReportParamsSchema = CancelReportParamsSchema

export const RespondReportBodySchema = z
  .object({
    response: z.string().trim().min(1).max(4000)
  })
  .strict()

export const RespondReportResSchema = ReportSchema

export type ReportTypeModel = z.infer<typeof ReportSchema>
export type GetReportsQueryType = z.infer<typeof GetReportsQuerySchema>
export type GetReportsResType = z.infer<typeof GetReportsResSchema>
export type GetMyReportsResType = z.infer<typeof GetMyReportsResSchema>
export type CreateReportBodyType = z.infer<typeof CreateReportBodySchema>
export type CreateReportResType = z.infer<typeof CreateReportResSchema>
export type CancelReportParamsType = z.infer<typeof CancelReportParamsSchema>
export type CancelReportResType = z.infer<typeof CancelReportResSchema>
export type AcknowledgeReportParamsType = z.infer<typeof AcknowledgeReportParamsSchema>
export type AcknowledgeReportResType = z.infer<typeof AcknowledgeReportResSchema>
export type RespondReportParamsType = z.infer<typeof RespondReportParamsSchema>
export type RespondReportBodyType = z.infer<typeof RespondReportBodySchema>
export type RespondReportResType = z.infer<typeof RespondReportResSchema>
export type GetReportParamsType = z.infer<typeof GetReportParamsSchema>
export type GetReportResType = z.infer<typeof GetReportResSchema>
