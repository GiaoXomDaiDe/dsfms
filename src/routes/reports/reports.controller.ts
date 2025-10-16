import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  AcknowledgeReportParamsDTO,
  AcknowledgeReportResDTO,
  CancelReportParamsDTO,
  CancelReportResDTO,
  CreateReportBodyDTO,
  CreateReportResDTO,
  GetMyReportsQueryDTO,
  GetMyReportsResDTO,
  GetReportParamsDTO,
  GetReportResDTO,
  GetReportsQueryDTO,
  GetReportsResDTO,
  RespondReportBodyDTO,
  RespondReportParamsDTO,
  RespondReportResDTO
} from '~/routes/reports/reports.dto'
import { ReportsService } from '~/routes/reports/reports.service'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getReports(@Query() query: GetReportsQueryDTO): Promise<GetReportsResDTO> {
    return this.reportsService.getReports(query)
  }

  @Get('my-reports')
  async getMyReports(
    @ActiveUser('userId') userId: string,
    @Query() query: GetMyReportsQueryDTO
  ): Promise<GetMyReportsResDTO> {
    return this.reportsService.getMyReports(userId, query)
  }

  @Get(':id')
  async getReportById(@Param() params: GetReportParamsDTO): Promise<GetReportResDTO> {
    return this.reportsService.getReportById(params.id)
  }

  @Post()
  async createReport(
    @Body() body: CreateReportBodyDTO,
    @ActiveUser('userId') userId: string
  ): Promise<CreateReportResDTO> {
    return this.reportsService.createReport(body, userId)
  }

  @Put(':id/cancel')
  async cancelReport(
    @Param() params: CancelReportParamsDTO,
    @ActiveUser('userId') userId: string
  ): Promise<CancelReportResDTO> {
    return this.reportsService.cancelReport(params.id, userId)
  }

  @Put(':id/acknowledge')
  async acknowledgeReport(
    @Param() params: AcknowledgeReportParamsDTO,
    @ActiveUser('userId') userId: string
  ): Promise<AcknowledgeReportResDTO> {
    return this.reportsService.acknowledgeReport(params.id, userId)
  }

  @Put(':id/respond')
  async respondToReport(
    @Param() params: RespondReportParamsDTO,
    @Body() body: RespondReportBodyDTO,
    @ActiveUser('userId') userId: string
  ): Promise<RespondReportResDTO> {
    return this.reportsService.respondToReport(params.id, body, userId)
  }
}
