import { Injectable } from '@nestjs/common'
import { RequestStatus } from '@prisma/client'
import {
  CanOnlyAcknowledgeCreatedReportException,
  CanOnlyCancelCreatedReportException,
  CanOnlyCancelOwnReportException,
  CanOnlyRespondAcknowledgedReportException,
  ReportNotFoundException
} from '~/routes/reports/reports.error'
import {
  CreateReportBodyType,
  CreateReportResType,
  GetMyReportsResType,
  GetReportResType,
  GetReportsQueryType,
  GetReportsResType,
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

  async getMyReports(userId: string, query: GetReportsQueryType): Promise<GetMyReportsResType> {
    return this.reportsRepo.listMe(userId, query)
  }

  async getReportById(id: string): Promise<GetReportResType> {
    const report = await this.reportsRepo.findById(id)

    if (!report) {
      throw ReportNotFoundException
    }
    return report
  }

  async createReport(data: CreateReportBodyType, createdById: string): Promise<CreateReportResType> {
    return this.reportsRepo.create({ data, createdById })
  }

  async cancelReport(id: string, userId: string): Promise<GetReportResType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw ReportNotFoundException
    }

    // Chỉ có ng tạo report mới được cancel
    if (existingReport.createdById !== userId) {
      throw CanOnlyCancelOwnReportException
    }

    // Chỉ có thể cancel report đang không được acknowledge hoặc resolved
    if (existingReport.status !== RequestStatus.CREATED) {
      throw CanOnlyCancelCreatedReportException
    }

    return this.reportsRepo.cancel({ id, updatedById: userId })
  }

  async acknowledgeReport(id: string, managedById: string): Promise<GetReportResType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw ReportNotFoundException
    }

    // Chỉ có thể acknowledge report đang ở trạng thái CREATED
    if (existingReport.status !== RequestStatus.CREATED) {
      throw CanOnlyAcknowledgeCreatedReportException
    }

    return this.reportsRepo.acknowledge({ id, managedById })
  }

  async respondToReport(id: string, data: RespondReportBodyType, managedById: string): Promise<RespondReportResType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw ReportNotFoundException
    }

    // Chỉ có thể respond report đang ở trạng thái ACKNOWLEDGED
    if (existingReport.status !== RequestStatus.ACKNOWLEDGED) {
      throw CanOnlyRespondAcknowledgedReportException
    }

    return this.reportsRepo.respond({ id, data, managedById })
  }
}
