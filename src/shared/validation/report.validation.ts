import z from 'zod'
import { ReportSeverity, ReportStatus, ReportType } from '~/shared/constants/report.constant'
import { createEnumSchema, nullableStringField } from '~/shared/helpers/zod-validation.helper'

const buildEnumMessage = (label: string, values: readonly string[]) => `${label} must be one of: ${values.join(', ')}`

type ReportTypeLiteral = (typeof ReportType)[keyof typeof ReportType]
type ReportSeverityLiteral = (typeof ReportSeverity)[keyof typeof ReportSeverity]
type ReportStatusLiteral = (typeof ReportStatus)[keyof typeof ReportStatus]

const REPORT_TYPE_VALUES: [ReportTypeLiteral, ...ReportTypeLiteral[]] = [
  ReportType.SAFETY_REPORT,
  ReportType.INSTRUCTOR_REPORT,
  ReportType.FATIGUE_REPORT,
  ReportType.TRAINING_PROGRAM_REPORT,
  ReportType.FACILITIES_REPORT,
  ReportType.COURSE_ORGANIZATION_REPORT,
  ReportType.FEEDBACK,
  ReportType.OTHER
]

const REPORT_SEVERITY_VALUES: [ReportSeverityLiteral, ...ReportSeverityLiteral[]] = [
  ReportSeverity.LOW,
  ReportSeverity.MEDIUM,
  ReportSeverity.HIGH,
  ReportSeverity.CRITICAL
]

const REPORT_STATUS_VALUES: [ReportStatusLiteral, ...ReportStatusLiteral[]] = [
  ReportStatus.SUBMITTED,
  ReportStatus.ACKNOWLEDGED,
  ReportStatus.RESOLVED,
  ReportStatus.CANCELLED
]

export const reportTypeSchema = createEnumSchema(
  REPORT_TYPE_VALUES,
  buildEnumMessage('Report type', REPORT_TYPE_VALUES)
)

export const reportSeveritySchema = nullableStringField(
  createEnumSchema(REPORT_SEVERITY_VALUES, buildEnumMessage('Report severity', REPORT_SEVERITY_VALUES))
)

export const reportStatusSchema = createEnumSchema(
  REPORT_STATUS_VALUES,
  buildEnumMessage('Report status', REPORT_STATUS_VALUES)
)

const nullableText = (field: string, max: number) =>
  nullableStringField(z.string().trim().max(max, `${field} must not exceed ${max} characters`))

export const reportTitleSchema = nullableText('Report title', 255)
export const reportDescriptionSchema = nullableText('Report description', 4000)
export const reportActionsTakenSchema = nullableText('Report actions taken', 2000)
export const reportResponseSchema = nullableText('Report response', 4000)
