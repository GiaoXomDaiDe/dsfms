import { z } from 'zod'
import { RequestSeverity, RequestStatus, RequestType } from '~/shared/constants/report.constant'
import { ReportSchema } from '~/shared/models/shared-report.model'

const requestTypeValues = Object.values(RequestType) as [string, ...string[]]
const requestSeverityValues = Object.values(RequestSeverity) as [string, ...string[]]
const requestStatusValues = Object.values(RequestStatus) as [string, ...string[]]

const optionalBoundedString = (max: number) => z.string().trim().min(1).max(max)
const nullableBoundedString = (max: number) => z.string().max(max).nullable()

export const ReportUserSummarySchema = z.object({
  id: z.string().uuid(),
  eid: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  roleName: z.string().nullable()
})

export const ReportAssessmentSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable()
  })
  .nullable()

export const ReportWithRelationsSchema = ReportSchema.extend({
  createdBy: ReportUserSummarySchema,
  managedBy: ReportUserSummarySchema.nullable(),
  updatedBy: ReportUserSummarySchema.nullable(),
  assessment: ReportAssessmentSchema
})

export const ReportListItemSchema = ReportWithRelationsSchema

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10)
})

export const GetReportsQuerySchema = ReportSchema.pick({
  requestType: true,
  status: true,
  isAnonymous: true,
  severity: true
}).strict()

export const GetMyReportsQuerySchema = paginationSchema
  .extend({
    reportType: z.enum(RequestType).optional(),
    status: z.enum(RequestStatus).optional()
  })
  .strict()

export const GetReportsResSchema = z.object({
  reports: z.array(ReportListItemSchema),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int()
})

export const GetMyReportsResSchema = GetReportsResSchema

export const GetReportParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const CreateReportBodySchema = z
  .object({
    reportType: z.enum(RequestType).optional(),
    severity: z.enum(RequestSeverity).optional(),
    title: optionalBoundedString(255),
    description: optionalBoundedString(4000).optional(),
    actionsTaken: optionalBoundedString(2000).optional(),
    isAnonymous: z.boolean().optional().default(false),
    assessmentId: z.string().uuid().optional()
  })
  .strict()

export const CreateReportResSchema = ReportWithRelationsSchema

export const CancelReportParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const CancelReportResSchema = ReportWithRelationsSchema

export const AcknowledgeReportParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const AcknowledgeReportResSchema = ReportWithRelationsSchema

export const RespondReportParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const RespondReportBodySchema = z
  .object({
    response: optionalBoundedString(4000)
  })
  .strict()

export const RespondReportResSchema = ReportWithRelationsSchema

export const GetReportResSchema = ReportWithRelationsSchema

export type ReportTypeModel = z.infer<typeof ReportSchema>
export type ReportListItemType = z.infer<typeof ReportListItemSchema>
export type ReportWithRelationsType = z.infer<typeof ReportWithRelationsSchema>
export type GetReportsQueryType = z.infer<typeof GetReportsQuerySchema>
export type GetReportsResType = z.infer<typeof GetReportsResSchema>
export type GetMyReportsQueryType = z.infer<typeof GetMyReportsQuerySchema>
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
