import type { NodemailerService } from '~/routes/email/nodemailer.service'
import {
  CanOnlyAcknowledgeSubmittedReportException,
  CanOnlyCancelOwnReportException,
  CanOnlyCancelSubmittedReportException,
  CanOnlyRespondAcknowledgedReportException,
  ReportNotFoundException
} from '~/routes/reports/reports.error'
import type {
  CreateReportBodyType,
  GetReportResType,
  GetReportsQueryType,
  RespondReportBodyType
} from '~/routes/reports/reports.model'
import { ReportsRepository } from '~/routes/reports/reports.repo'
import { ReportsService } from '~/routes/reports/reports.service'
import { ReportStatus, ReportType } from '~/shared/constants/report.constant'
import { RoleName } from '~/shared/constants/role.constant'
import type { PrismaService } from '~/shared/services/prisma.service'

const baseUser = {
  id: 'u1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: { name: RoleName.ADMINISTRATOR }
}

const baseReport: GetReportResType = {
  id: 'r1',
  requestType: ReportType.SAFETY_REPORT,
  createdById: 'u1',
  severity: 'LOW',
  title: 'Issue',
  description: 'desc',
  actionsTaken: null,
  isAnonymous: false,
  status: ReportStatus.SUBMITTED,
  managedById: null,
  response: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  updatedById: null,
  createdBy: baseUser,
  updatedBy: null,
  managedBy: null
}

describe('ReportsService', () => {
  const reportsRepo: jest.Mocked<
    Pick<ReportsRepository, 'list' | 'listMe' | 'findById' | 'create' | 'cancel' | 'acknowledge' | 'respond'>
  > = {
    list: jest.fn(),
    listMe: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    cancel: jest.fn(),
    acknowledge: jest.fn(),
    respond: jest.fn()
  }

  const emailService: jest.Mocked<
    Pick<
      NodemailerService,
      'sendBulkReportNotifications' | 'sendReportResponseToCreator' | 'sendReportResponseConfirmationToManager'
    >
  > = {
    sendBulkReportNotifications: jest.fn(),
    sendReportResponseToCreator: jest.fn(),
    sendReportResponseConfirmationToManager: jest.fn()
  }

  const prisma: Partial<PrismaService> = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    } as any
  }

  const service = new ReportsService(
    reportsRepo as unknown as ReportsRepository,
    emailService as unknown as NodemailerService,
    prisma as PrismaService
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getReports delegates to repo', async () => {
    const query: GetReportsQueryType = {
      requestType: undefined,
      status: ReportStatus.SUBMITTED,
      severity: undefined,
      isAnonymous: undefined
    }
    const expected = { reports: [baseReport], totalItems: 1 }
    reportsRepo.list.mockResolvedValue(expected)

    const result = await service.getReports(query)

    expect(reportsRepo.list).toHaveBeenCalledWith(query)
    expect(result).toBe(expected)
  })

  it('getMyReports delegates to repo', async () => {
    const query: GetReportsQueryType = {
      requestType: [ReportType.SAFETY_REPORT],
      status: undefined,
      severity: undefined,
      isAnonymous: undefined
    }
    const expected = { reports: [baseReport], totalItems: 1 }
    reportsRepo.listMe.mockResolvedValue(expected)

    const result = await service.getMyReports('u1', query)

    expect(reportsRepo.listMe).toHaveBeenCalledWith('u1', query)
    expect(result).toBe(expected)
  })

  it('getReportById throws when missing', async () => {
    reportsRepo.findById.mockResolvedValue(null)

    await expect(service.getReportById('missing')).rejects.toBe(ReportNotFoundException)
  })

  it('createReport creates and emails auditors', async () => {
    const payload: CreateReportBodyType = {
      requestType: ReportType.SAFETY_REPORT,
      isAnonymous: false,
      severity: 'LOW',
      title: 'Issue',
      description: 'desc',
      actionsTaken: null
    }
    const createdReport = { ...baseReport, id: 'r2' }
    reportsRepo.create.mockResolvedValue(createdReport)
    ;(prisma.user!.findMany as jest.Mock).mockResolvedValue([{ email: 'a@example.com', firstName: 'A', lastName: 'B' }])
    emailService.sendBulkReportNotifications.mockResolvedValue({ success: true, results: [] })

    const result = await service.createReport(payload, 'u1')

    expect(reportsRepo.create).toHaveBeenCalledWith({ data: payload, createdById: 'u1' })
    expect(emailService.sendBulkReportNotifications).toHaveBeenCalled()
    expect(result).toBe(createdReport)
  })

  it('cancelReport enforces ownership and status', async () => {
    reportsRepo.findById.mockResolvedValue({ ...baseReport, createdById: 'other', status: ReportStatus.SUBMITTED })

    await expect(service.cancelReport('r1', 'u1')).rejects.toBe(CanOnlyCancelOwnReportException)

    reportsRepo.findById.mockResolvedValue({ ...baseReport, status: ReportStatus.RESOLVED })

    await expect(service.cancelReport('r1', 'u1')).rejects.toBe(CanOnlyCancelSubmittedReportException)
  })

  it('cancelReport succeeds', async () => {
    const submitted = { ...baseReport, status: ReportStatus.SUBMITTED }
    reportsRepo.findById.mockResolvedValue(submitted)
    reportsRepo.cancel.mockResolvedValue({ ...submitted, status: ReportStatus.CANCELLED })

    const result = await service.cancelReport('r1', 'u1')

    expect(reportsRepo.cancel).toHaveBeenCalledWith({ id: 'r1', updatedById: 'u1' })
    expect(result.status).toBe(ReportStatus.CANCELLED)
  })

  it('acknowledgeReport only allows submitted status', async () => {
    reportsRepo.findById.mockResolvedValue({ ...baseReport, status: ReportStatus.RESOLVED })

    await expect(service.acknowledgeReport('r1', 'u2')).rejects.toBe(CanOnlyAcknowledgeSubmittedReportException)
  })

  it('acknowledgeReport updates status', async () => {
    reportsRepo.findById.mockResolvedValue({ ...baseReport, status: ReportStatus.SUBMITTED })
    reportsRepo.acknowledge.mockResolvedValue({ ...baseReport, status: ReportStatus.ACKNOWLEDGED })

    const result = await service.acknowledgeReport('r1', 'u2')

    expect(reportsRepo.acknowledge).toHaveBeenCalledWith({ id: 'r1', managedById: 'u2' })
    expect(result.status).toBe(ReportStatus.ACKNOWLEDGED)
  })

  it('respondToReport only allows acknowledged status', async () => {
    reportsRepo.findById.mockResolvedValue({ ...baseReport, status: ReportStatus.SUBMITTED })

    await expect(service.respondToReport('r1', { response: 'hi' }, 'm1')).rejects.toBe(
      CanOnlyRespondAcknowledgedReportException
    )
  })

  it('respondToReport updates and emails participants', async () => {
    const acknowledged = { ...baseReport, status: ReportStatus.ACKNOWLEDGED }
    reportsRepo.findById.mockResolvedValue(acknowledged)
    ;(prisma.user!.findUnique as jest.Mock).mockResolvedValue({
      firstName: 'Manager',
      middleName: null,
      lastName: 'One',
      email: 'manager@example.com'
    })
    reportsRepo.respond.mockResolvedValue({
      ...acknowledged,
      status: ReportStatus.RESOLVED,
      response: 'ok',
      managedById: 'm1'
    })
    emailService.sendReportResponseToCreator.mockResolvedValue({ success: true, message: 'ok' })
    emailService.sendReportResponseConfirmationToManager.mockResolvedValue({ success: true, message: 'ok' })

    const body: RespondReportBodyType = { response: 'ok' }
    const result = await service.respondToReport('r1', body, 'm1')

    expect(reportsRepo.respond).toHaveBeenCalledWith({ id: 'r1', data: body, managedById: 'm1' })
    expect(emailService.sendReportResponseToCreator).toHaveBeenCalled()
    expect(emailService.sendReportResponseConfirmationToManager).toHaveBeenCalled()
    expect(result.status).toBe(ReportStatus.RESOLVED)
  })
})
