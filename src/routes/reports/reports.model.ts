import { z } from 'zod'
import { RequestSeverity, RequestStatus, RequestType } from '~/shared/constants/report.constant'
import { ReportSchema } from '~/shared/models/shared-report.model'

export const GetReportsQuerySchema = z
  .object({
    requestType: z.enum(RequestType).optional(),
    status: z.enum(RequestStatus).optional(),
    severity: z.enum(RequestSeverity).optional(),
    isAnonymous: z.coerce.boolean().optional()
  })
  .strict()

export const GetReportsResSchema = z.object({
  reports: z.array(ReportSchema),
  totalItems: z.number().int()
})

export const GetMyReportsResSchema = GetReportsResSchema

export const GetReportResSchema = ReportSchema

export const GetReportParamsSchema = ReportSchema.pick({
  id: true
}).strict()

const BaseReportSchema = z.object({
  isAnonymous: z.boolean().optional().default(false)
})

const AssessmentApprovalSchema = BaseReportSchema.extend({
  requestType: z.literal(RequestType.ASSESSMENT_APPROVAL_REQUEST),
  assessmentId: z.uuid(),
  // Những fields sau KHÔNG ĐƯỢC PHÉP xuất hiện trong approval request
  severity: z.never().optional(),
  title: z.never().optional(),
  description: z.never().optional(),
  actionsTaken: z.never().optional()
})

const ReportTypeSchema = BaseReportSchema.extend({
  requestType: z.enum([
    RequestType.SAFETY_REPORT,
    RequestType.INSTRUCTOR_REPORT,
    RequestType.FATIGUE_REPORT,
    RequestType.TRAINING_PROGRAM_REPORT,
    RequestType.FACILITIES_REPORT,
    RequestType.COURSE_ORGANIZATION_REPORT,
    RequestType.OTHER
  ]),
  severity: z.enum(RequestSeverity).optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(4000).optional(),
  actionsTaken: z.string().trim().min(1).max(2000).optional(),
  // assessmentId is không được phép cho các loại report này
  assessmentId: z.never().optional()
})

// Discriminated Union dựa theo requestType
export const CreateReportBodySchema = z.discriminatedUnion('requestType', [AssessmentApprovalSchema, ReportTypeSchema])

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
