import { z } from 'zod'
import type { ReportTypeValue } from '~/shared/constants/report.constant'
import { ReportSeverity, ReportStatus, ReportType } from '~/shared/constants/report.constant'
import { ReportSchema } from '~/shared/models/shared-report.model'

export const REQUEST_TYPE_FILTER_MAP: Record<'INCIDENT' | 'FEEDBACK' | 'OTHER', ReportTypeValue[]> = {
  INCIDENT: [
    ReportType.SAFETY_REPORT,
    ReportType.INSTRUCTOR_REPORT,
    ReportType.FATIGUE_REPORT,
    ReportType.TRAINING_PROGRAM_REPORT,
    ReportType.FACILITIES_REPORT,
    ReportType.COURSE_ORGANIZATION_REPORT
  ],
  FEEDBACK: [ReportType.FEEDBACK],
  OTHER: [ReportType.OTHER]
}

export const GetReportsQuerySchema = z
  .object({
    requestType: z
      .enum(['INCIDENT', 'FEEDBACK', 'OTHER'])
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

const ReportTypeSchema = z.object({
  isAnonymous: z.boolean().optional().default(false),
  requestType: z.enum([
    ReportType.SAFETY_REPORT,
    ReportType.INSTRUCTOR_REPORT,
    ReportType.FATIGUE_REPORT,
    ReportType.TRAINING_PROGRAM_REPORT,
    ReportType.FACILITIES_REPORT,
    ReportType.COURSE_ORGANIZATION_REPORT,
    ReportType.FEEDBACK,
    ReportType.OTHER
  ]),
  severity: z.enum(ReportSeverity).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(4000).optional(),
  actionsTaken: z.string().trim().min(1).max(2000).optional()
})

// Discriminated Union dựa theo requestType
export const CreateReportBodySchema = ReportTypeSchema

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
