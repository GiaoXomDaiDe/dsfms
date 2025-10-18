import { Injectable } from '@nestjs/common'
import { Prisma, RequestSeverity, RequestStatus, RequestType } from '@prisma/client'
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
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class ReportsRepo {
  private readonly reportInclude = {
    createdBy: {
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      }
    },
    managedBy: {
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      }
    },
    updatedBy: {
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      }
    },
    assessment: {
      select: {
        id: true,
        name: true
      }
    }
  } satisfies Prisma.RequestInclude

  // Report types only (exclude ASSESSMENT_APPROVAL_REQUEST)
  private readonly reportTypes: RequestType[] = [
    RequestType.SAFETY_REPORT,
    RequestType.INCIDENT_REPORT,
    RequestType.FEEDBACK_REPORT
  ]

  constructor(private readonly prisma: PrismaService) {}

  async list(query: GetReportsQueryType): Promise<GetReportsResType> {
    const { severity, status, isAnonymous, requestType } = query

    const where: Prisma.RequestWhereInput = {
      requestType: { in: requestType ? [requestType as RequestType] : this.reportTypes },
      ...(severity && { severity: severity as RequestSeverity }),
      ...(status && { status: status as RequestStatus }),
      ...(isAnonymous !== undefined && { isAnonymous })
    }

    const [totalItems, reports] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        include: this.reportInclude
      })
    ])

    const formattedReports = reports.map((report) => this.mapReport(report))

    return {
      reports: formattedReports,
      totalItems
    }
  }

  async listMine(userId: string, query: GetMyReportsQueryType): Promise<GetMyReportsResType> {
    const { page = 1, limit = 10, reportType, status } = query
    const skip = (page - 1) * limit

    const where: Prisma.RequestWhereInput = {
      createdById: userId,
      requestType: { in: reportType ? [reportType as RequestType] : this.reportTypes },
      ...(status && { status: status as RequestStatus })
    }

    const [totalItems, reports] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        include: this.reportInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ])

    const formattedReports = reports.map((report) => this.mapReport(report))
    const totalPages = limit === 0 ? 0 : Math.ceil(totalItems / limit)

    return {
      reports: formattedReports,
      totalItems
    }
  }

  async findById(id: string): Promise<ReportWithRelationsType | null> {
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

    return this.mapReport(report)
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
        requestType: data.reportType as RequestType,
        createdById,
        severity: data.severity as RequestSeverity,
        title: data.title,
        description: data.description ?? null,
        actionsTaken: data.actionsTaken ?? null,
        isAnonymous: data.isAnonymous ?? false,
        assessmentId: data.assessmentId ?? null,
        status: RequestStatus.CREATED
      },
      include: this.reportInclude
    })

    return this.mapReport(report)
  }

  async cancel({ id, updatedById }: { id: string; updatedById: string }): Promise<ReportWithRelationsType> {
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

    return this.mapReport(report)
  }

  async acknowledge({ id, managedById }: { id: string; managedById: string }): Promise<ReportWithRelationsType> {
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

    return this.mapReport(report)
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

    return this.mapReport(report)
  }

  private mapReport(report: any): ReportWithRelationsType {
    const { createdBy, managedBy, updatedBy, assessment, ...rest } = report

    return {
      ...rest,
      createdBy: {
        id: createdBy.id,
        eid: createdBy.eid,
        firstName: createdBy.firstName,
        lastName: createdBy.lastName,
        email: createdBy.email,
        roleName: createdBy.role?.name ?? null
      },
      managedBy: managedBy
        ? {
            id: managedBy.id,
            eid: managedBy.eid,
            firstName: managedBy.firstName,
            lastName: managedBy.lastName,
            email: managedBy.email,
            roleName: managedBy.role?.name ?? null
          }
        : null,
      updatedBy: updatedBy
        ? {
            id: updatedBy.id,
            eid: updatedBy.eid,
            firstName: updatedBy.firstName,
            lastName: updatedBy.lastName,
            email: updatedBy.email,
            roleName: updatedBy.role?.name ?? null
          }
        : null,
      assessment: assessment
        ? {
            id: assessment.id,
            name: assessment.name,
            description: null // AssessmentForm doesn't have description
          }
        : null
    } as ReportWithRelationsType
  }
}
