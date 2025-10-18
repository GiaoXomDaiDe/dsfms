import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { RequestStatus } from '@prisma/client'
import {
  CreateReportBodyType,
  CreateReportResType,
  GetMyReportsQueryType,
  GetMyReportsResType,
  GetReportsQueryType,
  GetReportsResType,
  ReportWithRelationsType,
  RespondReportBodyType,
  RespondReportResType
} from '~/routes/reports/reports.model'
import { ReportsRepo } from '~/routes/reports/reports.repo'

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepo: ReportsRepo) {}

  async getReports(query: GetReportsQueryType): Promise<GetReportsResType> {
    return this.reportsRepo.list(query)
  }

  async getMyReports(userId: string, query: GetMyReportsQueryType): Promise<GetMyReportsResType> {
    return this.reportsRepo.listMine(userId, query)
  }

  async getReportById(id: string): Promise<ReportWithRelationsType> {
    const report = await this.reportsRepo.findById(id)

    if (!report) {
      throw new NotFoundException('Report not found')
    }

    return report
  }

  async createReport(data: CreateReportBodyType, createdById: string): Promise<CreateReportResType> {
    return this.reportsRepo.create({ data, createdById })
  }

  async cancelReport(id: string, userId: string): Promise<ReportWithRelationsType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw new NotFoundException('Report not found')
    }

    // Only report creator can cancel their own report
    if (existingReport.createdById !== userId) {
      throw new BadRequestException('You can only cancel your own reports')
    }

    // Can only cancel reports that are not yet acknowledged or resolved
    if (existingReport.status !== RequestStatus.CREATED) {
      throw new BadRequestException('Can only cancel reports with CREATED status')
    }

    return this.reportsRepo.cancel({ id, updatedById: userId })
  }

  async acknowledgeReport(id: string, managedById: string): Promise<ReportWithRelationsType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw new NotFoundException('Report not found')
    }

    // Can only acknowledge reports that are in CREATED status
    if (existingReport.status !== RequestStatus.CREATED) {
      throw new BadRequestException('Can only acknowledge reports with CREATED status')
    }

    return this.reportsRepo.acknowledge({ id, managedById })
  }

  async respondToReport(id: string, data: RespondReportBodyType, managedById: string): Promise<RespondReportResType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw new NotFoundException('Report not found')
    }

    // Can only respond to reports that are acknowledged
    if (existingReport.status !== RequestStatus.ACKNOWLEDGED) {
      throw new BadRequestException('Can only respond to reports with ACKNOWLEDGED status')
    }

    return this.reportsRepo.respond({ id, data, managedById })
  }
}
