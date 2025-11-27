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
  RequestSeverityValue,
  RequestStatus,
  RequestStatusValue,
  RequestType,
  RequestTypeValue
} from '~/shared/constants/report.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { ReportType } from '~/shared/models/shared-report.model'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class ReportsRepo {
  private readonly reportTypes: RequestTypeValue[] = [
    RequestType.SAFETY_REPORT,
    RequestType.INSTRUCTOR_REPORT,
    RequestType.FATIGUE_REPORT,
    RequestType.TRAINING_PROGRAM_REPORT,
    RequestType.FACILITIES_REPORT,
    RequestType.COURSE_ORGANIZATION_REPORT,
    RequestType.OTHER,
    RequestType.FEEDBACK
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
    const report = await this.prisma.request.findUnique({
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
  ): Promise<{ reports: ReportType[]; totalItems: number }> {
    const { severity, status, isAnonymous, requestType } = query

    const where: Prisma.RequestWhereInput = {
      ...(requestType && { requestType: { in: requestType } }),
      ...(severity && { severity: severity as RequestSeverityValue }),
      ...(status && { status: status as RequestStatusValue }),
      ...(isAnonymous !== undefined && { isAnonymous }),
      ...(userId && { createdById: userId })
    }

    const [totalItems, reports] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
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
    const report = await this.prisma.request.create({
      data: {
        requestType: data.requestType as RequestTypeValue,
        createdById,
        isAnonymous: data.isAnonymous ?? false,
        status: RequestStatus.SUBMITTED,
        severity: (data.severity as RequestSeverityValue) ?? null,
        title: data.title ?? null,
        description: data.description ?? null,
        actionsTaken: data.actionsTaken ?? null
      },
      include: this.reportInclude
    })

    return report
  }

  async cancel({ id, updatedById }: { id: string; updatedById: string }): Promise<CancelReportResType> {
    const report = await this.prisma.request.update({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      data: {
        status: RequestStatus.CANCELLED,
        updatedById
      },
      include: this.reportInclude
    })

    return report
  }

  async acknowledge({ id, managedById }: { id: string; managedById: string }): Promise<AcknowledgeReportResType> {
    const report = await this.prisma.request.update({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      data: {
        status: RequestStatus.ACKNOWLEDGED,
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
    const report = await this.prisma.request.update({
      where: {
        id,
        requestType: { in: this.reportTypes }
      },
      data: {
        status: RequestStatus.RESOLVED,
        response: data.response,
        managedById,
        updatedById: managedById
      },
      include: this.reportInclude
    })

    return report
  }
}
