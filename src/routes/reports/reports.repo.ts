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
    RequestType.ASSESSMENT_APPROVAL_REQUEST
  ]

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
      }
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
      requestType: { in: requestType ? [requestType as RequestTypeValue] : this.reportTypes },
      ...(severity && { severity: severity as RequestSeverityValue }),
      ...(status && { status: status as RequestStatusValue }),
      ...(isAnonymous !== undefined && { isAnonymous }),
      ...(userId && { createdById: userId })
    }

    const [totalItems, reports] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where
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
    const baseData = {
      requestType: data.requestType as RequestTypeValue,
      createdById,
      isAnonymous: data.isAnonymous ?? false,
      status: RequestStatus.CREATED
    }

    if (data.requestType === RequestType.ASSESSMENT_APPROVAL_REQUEST) {
      const report = await this.prisma.request.create({
        data: {
          ...baseData,
          assessmentId: data.assessmentId,
          severity: null,
          title: null,
          description: null,
          actionsTaken: null
        }
      })
      return report
    }

    const report = await this.prisma.request.create({
      data: {
        ...baseData,
        severity: data.severity as RequestSeverityValue,
        title: data.title,
        description: data.description ?? null,
        actionsTaken: data.actionsTaken ?? null,
        assessmentId: null
      }
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
      }
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
      }
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
      }
    })

    return report
  }
}
