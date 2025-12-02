import { Injectable } from '@nestjs/common'
import { NodemailerService } from '~/routes/email/nodemailer.service'
import {
  CanOnlyAcknowledgeSubmittedReportException,
  CanOnlyCancelOwnReportException,
  CanOnlyCancelSubmittedReportException,
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
import { ReportsRepository } from '~/routes/reports/reports.repo'
import { RequestStatus } from '~/shared/constants/report.constant'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepo: ReportsRepository,
    private readonly emailService: NodemailerService,
    private readonly prisma: PrismaService
  ) {}

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
    // Create the report first
    const report = await this.reportsRepo.create({ data, createdById })

    // Send email notifications to all SQA auditors
    try {
      const auditors = await this.getSQAAuditors()
      if (auditors.length > 0) {
        const reportData = {
          reportId: report.id,
          reportType: report.requestType,
          reportTitle: report.title || 'Untitled Report',
          reportSeverity: report.severity || 'Not specified',
          reportDescription: report.description || 'No description provided',
          reporterName: report.isAnonymous 
            ? 'Anonymous User' 
            : `${report.createdBy.firstName} ${report.createdBy.lastName}`,
          creationDate: report.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }

        const emailResult = await this.emailService.sendBulkReportNotifications(auditors, reportData)
        
        if (!emailResult.success) {
          console.error('Failed to send some report notifications:', emailResult.results)
        }
      }
    } catch (error) {
      console.error('Error sending report creation notifications:', error)
      // Don't fail the report creation if email fails
    }

    return report
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
    if (existingReport.status !== RequestStatus.SUBMITTED) {
      throw CanOnlyCancelSubmittedReportException
    }

    return this.reportsRepo.cancel({ id, updatedById: userId })
  }

  async acknowledgeReport(id: string, managedById: string): Promise<GetReportResType> {
    const existingReport = await this.reportsRepo.findById(id)

    if (!existingReport) {
      throw ReportNotFoundException
    }

    // Chỉ có thể acknowledge report đang ở trạng thái SUBMITTED
    if (existingReport.status !== RequestStatus.SUBMITTED) {
      throw CanOnlyAcknowledgeSubmittedReportException
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

    // Get manager info before updating
    const manager = await this.prisma.user.findUnique({
      where: { id: managedById },
      select: {
        firstName: true,
        lastName: true,
        email: true
      }
    })

    const updatedReport = await this.reportsRepo.respond({ id, data, managedById })

    // Send email notifications after successful response
    try {
      const responseDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const submissionDate = updatedReport.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      // 1. Send notification to report creator (if not anonymous)
      if (!updatedReport.isAnonymous && updatedReport.createdBy?.email) {
        const creatorResult = await this.emailService.sendReportResponseToCreator(
          updatedReport.createdBy.email,
          `${updatedReport.createdBy.firstName} ${updatedReport.createdBy.lastName}`,
          updatedReport.requestType,
          updatedReport.title || 'Untitled Report',
          submissionDate,
          manager ? `${manager.firstName} ${manager.lastName}` : 'System Administrator',
          responseDate,
          data.response
        )

        if (!creatorResult.success) {
          console.error('Failed to send response notification to creator:', creatorResult.message)
        }
      }

      // 2. Send confirmation to manager
      if (manager?.email) {
        const managerResult = await this.emailService.sendReportResponseConfirmationToManager(
          manager.email,
          `${manager.firstName} ${manager.lastName}`,
          updatedReport.requestType,
          updatedReport.title || 'Untitled Report',
          updatedReport.isAnonymous 
            ? 'Anonymous User' 
            : `${updatedReport.createdBy.firstName} ${updatedReport.createdBy.lastName}`,
          submissionDate,
          responseDate,
          data.response
        )

        if (!managerResult.success) {
          console.error('Failed to send response confirmation to manager:', managerResult.message)
        }
      }
    } catch (error) {
      console.error('Error sending report response notifications:', error)
      // Don't fail the response if email fails
    }

    return updatedReport
  }

  /**
   * Get all SQA auditors in the system for email notifications
   */
  private async getSQAAuditors(): Promise<Array<{ email: string; name: string }>> {
    try {
      const auditors = await this.prisma.user.findMany({
        where: {
          role: {
            name: RoleName.SQA_AUDITOR
          },
          deletedAt: null,
          status: 'ACTIVE'
        },
        select: {
          email: true,
          firstName: true,
          lastName: true
        }
      })

      return auditors.map(auditor => ({
        email: auditor.email,
        name: `${auditor.firstName} ${auditor.lastName}`
      }))
    } catch (error) {
      console.error('Error fetching SQA auditors:', error)
      return []
    }
  }
}
