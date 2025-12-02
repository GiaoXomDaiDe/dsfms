import z from 'zod'
import { isoDatetimeSchema, nullableUuidSchema } from '~/shared/helpers/zod-validation.helper'
import {
  reportActionsTakenSchema,
  reportDescriptionSchema,
  reportResponseSchema,
  reportSeveritySchema,
  reportStatusSchema,
  reportTitleSchema,
  reportTypeSchema
} from '~/shared/validation/report.validation'
import { userNameSchema as reportName } from '~/shared/validation/user.validation'

export const reportUserSummarySchema = z.object({
  id: z.uuid(),
  firstName: reportName,
  lastName: reportName,
  email: z.email().max(255),
  role: z.object({
    name: z.string().max(100)
  })
})

export const ReportSchema = z.object({
  id: z.uuid(),
  requestType: reportTypeSchema,
  createdById: z.uuid(),
  severity: reportSeveritySchema,
  title: reportTitleSchema,
  description: reportDescriptionSchema,
  actionsTaken: reportActionsTakenSchema,
  isAnonymous: z.boolean().default(false),
  status: reportStatusSchema,
  managedById: nullableUuidSchema,
  response: reportResponseSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  updatedById: nullableUuidSchema,
  createdBy: reportUserSummarySchema.nullable(),
  updatedBy: reportUserSummarySchema.nullable(),
  managedBy: reportUserSummarySchema.nullable()
})

export type ReportModel = z.infer<typeof ReportSchema>
