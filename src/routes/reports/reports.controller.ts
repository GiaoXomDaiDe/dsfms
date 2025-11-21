import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto, ZodValidationPipe } from 'nestjs-zod'
import {
  AcknowledgeReportParamsDTO,
  AcknowledgeReportResDTO,
  CancelReportParamsDTO,
  CancelReportResDTO,
  CreateReportResDTO,
  GetMyReportsResDTO,
  GetReportResDTO,
  GetReportsQueryDTO,
  GetReportsResDTO,
  RespondReportBodyDTO,
  RespondReportParamsDTO,
  RespondReportResDTO
} from '~/routes/reports/reports.dto'
import type { CreateReportBodyType } from '~/routes/reports/reports.model'
import { CreateReportBodySchema } from '~/routes/reports/reports.model'
import { ReportsService } from '~/routes/reports/reports.service'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ZodSerializerDto(GetReportsResDTO)
  async getReports(@Query() query: GetReportsQueryDTO) {
    return this.reportsService.getReports(query)
  }

  @Get('my-reports')
  @ZodSerializerDto(GetMyReportsResDTO)
  async getMyReports(
    @ActiveUser('userId') userId: string,
    @Query() query: GetReportsQueryDTO
  ): Promise<GetMyReportsResDTO> {
    return this.reportsService.getMyReports(userId, query)
  }

  @Get(':reportId')
  @ZodSerializerDto(GetReportResDTO)
  async getReportById(@Param('reportId') reportId: string) {
    return this.reportsService.getReportById(reportId)
  }

  @Post()
  @ZodSerializerDto(CreateReportResDTO)
  async createReport(
    @Body(new ZodValidationPipe(CreateReportBodySchema)) body: CreateReportBodyType,
    @ActiveUser('userId') userId: string
  ): Promise<CreateReportResDTO> {
    return this.reportsService.createReport(body, userId)
  }

  @Put(':reportId/cancel')
  async cancelReport(
    @Param() params: CancelReportParamsDTO,
    @ActiveUser('userId') userId: string
  ): Promise<CancelReportResDTO> {
    return this.reportsService.cancelReport(params.id, userId)
  }

  @Put(':reportId/acknowledge')
  async acknowledgeReport(
    @Param() params: AcknowledgeReportParamsDTO,
    @ActiveUser('userId') userId: string
  ): Promise<AcknowledgeReportResDTO> {
    return this.reportsService.acknowledgeReport(params.id, userId)
  }

  @Put(':reportId/respond')
  async respondToReport(
    @Param() params: RespondReportParamsDTO,
    @Body() body: RespondReportBodyDTO,
    @ActiveUser('userId') userId: string
  ): Promise<RespondReportResDTO> {
    return this.reportsService.respondToReport(params.id, body, userId)
  }
}
