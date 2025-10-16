import { createZodDto } from 'nestjs-zod'
import {
  AcknowledgeReportParamsSchema,
  AcknowledgeReportResSchema,
  CancelReportParamsSchema,
  CancelReportResSchema,
  CreateReportBodySchema,
  CreateReportResSchema,
  GetMyReportsQuerySchema,
  GetMyReportsResSchema,
  GetReportParamsSchema,
  GetReportResSchema,
  GetReportsQuerySchema,
  GetReportsResSchema,
  RespondReportBodySchema,
  RespondReportParamsSchema,
  RespondReportResSchema
} from '~/routes/reports/reports.model'

export class GetReportsQueryDTO extends createZodDto(GetReportsQuerySchema) {}

export class GetReportsResDTO extends createZodDto(GetReportsResSchema) {}

export class GetMyReportsQueryDTO extends createZodDto(GetMyReportsQuerySchema) {}

export class GetMyReportsResDTO extends createZodDto(GetMyReportsResSchema) {}

export class GetReportParamsDTO extends createZodDto(GetReportParamsSchema) {}

export class GetReportResDTO extends createZodDto(GetReportResSchema) {}

export class CreateReportBodyDTO extends createZodDto(CreateReportBodySchema) {}

export class CreateReportResDTO extends createZodDto(CreateReportResSchema) {}

export class CancelReportParamsDTO extends createZodDto(CancelReportParamsSchema) {}

export class CancelReportResDTO extends createZodDto(CancelReportResSchema) {}

export class AcknowledgeReportParamsDTO extends createZodDto(AcknowledgeReportParamsSchema) {}

export class AcknowledgeReportResDTO extends createZodDto(AcknowledgeReportResSchema) {}

export class RespondReportParamsDTO extends createZodDto(RespondReportParamsSchema) {}

export class RespondReportBodyDTO extends createZodDto(RespondReportBodySchema) {}

export class RespondReportResDTO extends createZodDto(RespondReportResSchema) {}
