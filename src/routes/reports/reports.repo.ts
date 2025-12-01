import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  AcknowledgeReportResType,
  CancelReportResType,
  CreateReportBodyType,
  CreateReportResType,
  GetMyReportsResType,
  GetReportResType,
  GetReportsQueryType,
  GetReportsResType,
  RespondReportBodyType,
  RespondReportResType
} from '~/routes/reports/reports.model'
import {
  ReportSeverityValue,
  ReportStatus,
  ReportStatusValue,
  ReportType,
  ReportTypeValue
} from '~/shared/constants/report.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { ReportModel } from '~/shared/models/shared-report.model'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class ReportsRepository {
  private readonly reportTypes: ReportTypeValue[] = [
    ReportType.SAFETY_REPORT,
    ReportType.INSTRUCTOR_REPORT,
    ReportType.FATIGUE_REPORT,
    ReportType.TRAINING_PROGRAM_REPORT,
    ReportType.FACILITIES_REPORT,
    ReportType.COURSE_ORGANIZATION_REPORT,
    ReportType.OTHER,
    ReportType.FEEDBACK
  ]
  private readonly userSummarySelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    role: { select: { name: true } }
  } as const

  private readonly reportInclude = {
    createdBy: { select: this.userSummarySelect },
    updatedBy: { select: this.userSummarySelect },
    managedBy: { select: this.userSummarySelect }
  } as const

  constructor(private readonly prisma: PrismaService) {}

  async list(query: GetReportsQueryType): Promise<GetReportsResType> {
    return this.getReports(query)
  }

  async listMe(userId: string, query: GetReportsQueryType): Promise<GetMyReportsResType> {
    return this.getReports(query, userId)
  }

  async findById(id: string): Promise<GetReportResType | null> {
    const report = await this.prisma.report.findUnique({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      include: this.reportInclude
    })

    if (!report) {
      return null
    }

    return report
  }

  private async getReports(
    query: GetReportsQueryType,
    userId?: string
  ): Promise<{ reports: ReportModel[]; totalItems: number }> {
    const { severity, status, isAnonymous, requestType } = query

    const where: Prisma.ReportWhereInput = {
      ...(requestType && { requestType: { in: requestType } }),
      ...(severity && { severity: severity as ReportSeverityValue }),
      ...(status && { status: status as ReportStatusValue }),
      ...(isAnonymous !== undefined && { isAnonymous }),
      ...(userId && { createdById: userId })
    }

    const [totalItems, reports] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: this.reportInclude
      })
    ])

    return {
      reports,
      totalItems
    }
  }

  async create({
    data,
    createdById
  }: {
    data: CreateReportBodyType
    createdById: string
  }): Promise<CreateReportResType> {
    const report = await this.prisma.report.create({
      data: {
        requestType: data.requestType as ReportTypeValue,
        createdById,
        isAnonymous: data.isAnonymous ?? false,
        status: ReportStatus.SUBMITTED,
        severity: (data.severity as ReportSeverityValue) ?? null,
        title: data.title ?? null,
        description: data.description ?? null,
        actionsTaken: data.actionsTaken ?? null
      },
      include: this.reportInclude
    })

    return report
  }

  async cancel({ id, updatedById }: { id: string; updatedById: string }): Promise<CancelReportResType> {
    const report = await this.prisma.report.update({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      data: {
        status: ReportStatus.CANCELLED,
        updatedById
      },
      include: this.reportInclude
    })

    return report
  }

  async acknowledge({ id, managedById }: { id: string; managedById: string }): Promise<AcknowledgeReportResType> {
    const report = await this.prisma.report.update({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      data: {
        status: ReportStatus.ACKNOWLEDGED,
        managedById,
        updatedById: managedById
      },
      include: this.reportInclude
    })

    return report
  }

  async respond({
    id,
    data,
    managedById
  }: {
    id: string
    data: RespondReportBodyType
    managedById: string
  }): Promise<RespondReportResType> {
    const report = await this.prisma.report.update({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      data: {
        status: ReportStatus.RESOLVED,
        response: data.response,
        managedById,
        updatedById: managedById
      },
      include: this.reportInclude
    })

    return report
  }
}
