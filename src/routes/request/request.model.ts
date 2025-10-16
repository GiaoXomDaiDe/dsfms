import { z } from 'zod'
import { RequestSeverity, RequestStatus, RequestType } from '~/shared/constants/request.constant'

const requestTypeValues = Object.values(RequestType) as [string, ...string[]]
const requestSeverityValues = Object.values(RequestSeverity) as [string, ...string[]]
const requestStatusValues = Object.values(RequestStatus) as [string, ...string[]]

const coerceDateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return undefined
}, z.date())

const optionalBoundedString = (max: number) => z.string().trim().min(1).max(max)

const nullableBoundedString = (max: number) => z.string().max(max).nullable()

export const RequestSchema = z.object({
  id: z.string().uuid(),
  requestType: z.enum(requestTypeValues),
  createdByUserId: z.string().uuid(),
  severity: z.enum(requestSeverityValues).nullable(),
  title: nullableBoundedString(255),
  description: nullableBoundedString(4000),
  actionsTaken: nullableBoundedString(2000),
  isAnonymous: z.boolean().default(false),
  status: z.enum(requestStatusValues),
  managedByUserId: z.string().uuid().nullable(),
  response: nullableBoundedString(4000),
  assessmentId: z.string().uuid().nullable(),
  createdAt: coerceDateSchema,
  updatedAt: coerceDateSchema,
  updatedById: z.string().uuid().nullable()
})

export const RequestUserSummarySchema = z.object({
  id: z.string().uuid(),
  eid: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  roleName: z.string().nullable()
})

export const RequestAssessmentSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable()
  })
  .nullable()

export const RequestWithRelationsSchema = RequestSchema.extend({
  createdBy: RequestUserSummarySchema,
  managedBy: RequestUserSummarySchema.nullable(),
  updatedBy: RequestUserSummarySchema.nullable(),
  assessment: RequestAssessmentSchema
})

export const RequestListItemSchema = RequestWithRelationsSchema

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().optional().default(10)
})

export const GetRequestsQuerySchema = paginationSchema
  .extend({
    requestType: z.enum(requestTypeValues).optional(),
    severity: z.enum(requestSeverityValues).optional(),
    status: z.enum(requestStatusValues).optional(),
    managedByUserId: z.string().uuid().optional(),
    createdByUserId: z.string().uuid().optional(),
    search: z.string().trim().max(255).optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional()
  })
  .strict()

export const GetMyRequestsQuerySchema = paginationSchema
  .extend({
    requestType: z.enum(requestTypeValues).optional(),
    status: z.enum(requestStatusValues).optional()
  })
  .strict()

export const GetRequestsResSchema = z.object({
  requests: z.array(RequestListItemSchema),
  totalItems: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int()
})

export const GetMyRequestsResSchema = GetRequestsResSchema

export const GetRequestParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

export const CreateRequestBodySchema = z
  .object({
    requestType: z.enum(requestTypeValues),
    severity: z.enum(requestSeverityValues).optional(),
    title: optionalBoundedString(255).optional(),
    description: optionalBoundedString(4000).optional(),
    actionsTaken: optionalBoundedString(2000).optional(),
    isAnonymous: z.boolean().optional().default(false),
    assessmentId: z.string().uuid().optional()
  })
  .superRefine((data, ctx) => {
    if (data.requestType === RequestType.ASSESSMENT_APPROVAL_REQUEST) {
      if (!data.assessmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'assessmentId is required for assessment approval requests',
          path: ['assessmentId']
        })
      }

      const disallowedFields: Array<{ key: keyof typeof data; label: string }> = [
        { key: 'severity', label: 'severity' },
        { key: 'title', label: 'title' },
        { key: 'description', label: 'description' },
        { key: 'actionsTaken', label: 'actionsTaken' }
      ]

      disallowedFields.forEach(({ key, label }) => {
        if (data[key] !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} must be omitted for assessment approval requests`,
            path: [key]
          })
        }
      })
    } else {
      const requiredFields: Array<{ key: keyof typeof data; label: string }> = [
        { key: 'severity', label: 'severity' },
        { key: 'title', label: 'title' },
        { key: 'description', label: 'description' }
      ]

      requiredFields.forEach(({ key, label }) => {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} is required for incident or feedback reports`,
            path: [key]
          })
        }
      })
    }
  })

export const CreateRequestResSchema = RequestWithRelationsSchema

export const UpdateRequestStatusBodySchema = z
  .object({
    status: z.enum(requestStatusValues).optional(),
    managedByUserId: z.string().uuid().optional(),
    response: optionalBoundedString(4000).optional(),
    severity: z.enum(requestSeverityValues).optional(),
    actionsTaken: optionalBoundedString(2000).optional()
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
    path: []
  })

export const UpdateRequestStatusResSchema = RequestWithRelationsSchema

export const GetRequestResSchema = RequestWithRelationsSchema

export type RequestTypeModel = z.infer<typeof RequestSchema>
export type RequestListItemType = z.infer<typeof RequestListItemSchema>
export type RequestWithRelationsType = z.infer<typeof RequestWithRelationsSchema>
export type GetRequestsQueryType = z.infer<typeof GetRequestsQuerySchema>
export type GetRequestsResType = z.infer<typeof GetRequestsResSchema>
export type GetMyRequestsQueryType = z.infer<typeof GetMyRequestsQuerySchema>
export type GetMyRequestsResType = z.infer<typeof GetMyRequestsResSchema>
export type CreateRequestBodyType = z.infer<typeof CreateRequestBodySchema>
export type CreateRequestResType = z.infer<typeof CreateRequestResSchema>
export type UpdateRequestStatusBodyType = z.infer<typeof UpdateRequestStatusBodySchema>
export type UpdateRequestStatusResType = z.infer<typeof UpdateRequestStatusResSchema>
export type GetRequestParamsType = z.infer<typeof GetRequestParamsSchema>
export type GetRequestResType = z.infer<typeof GetRequestResSchema>
