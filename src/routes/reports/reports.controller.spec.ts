import { Test, TestingModule } from '@nestjs/testing'
import { ReportsController } from '~/routes/reports/reports.controller'
import type { GetReportResType, GetReportsQueryType } from '~/routes/reports/reports.model'
import { ReportsService } from '~/routes/reports/reports.service'
import { ReportStatus, ReportType } from '~/shared/constants/report.constant'

jest.mock('~/routes/reports/reports.service')

describe('ReportsController', () => {
  let controller: ReportsController
  let service: jest.Mocked<ReportsService>

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
    createdBy: {
      id: 'u1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: { name: 'ADMIN' }
    },
    updatedBy: null,
    managedBy: null
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [ReportsService]
    }).compile()

    controller = module.get(ReportsController)
    service = module.get(ReportsService)
    jest.clearAllMocks()
  })

  it('getReports delegates to service', async () => {
    const query: GetReportsQueryType = {
      requestType: undefined,
      status: undefined,
      severity: undefined,
      isAnonymous: undefined
    }
    const data = { reports: [baseReport], totalItems: 1 }
    service.getReports.mockResolvedValue(data)

    const result = await controller.getReports(query)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getReports).toHaveBeenCalledWith(query)
    expect(result).toBe(data)
  })

  it('getMyReports passes active user', async () => {
    const query: GetReportsQueryType = {
      requestType: undefined,
      status: ReportStatus.SUBMITTED,
      severity: undefined,
      isAnonymous: undefined
    }
    const data = { reports: [baseReport], totalItems: 1 }
    service.getMyReports.mockResolvedValue(data)

    const result = await controller.getMyReports('u1', query)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getMyReports).toHaveBeenCalledWith('u1', query)
    expect(result).toBe(data)
  })

  it('getReportById returns service result', async () => {
    service.getReportById.mockResolvedValue(baseReport)

    const result = await controller.getReportById('r1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getReportById).toHaveBeenCalledWith('r1')
    expect(result).toBe(baseReport)
  })

  it('createReport includes active user', async () => {
    const payload = {
      requestType: ReportType.SAFETY_REPORT,
      isAnonymous: false,
      severity: 'LOW',
      title: 'Issue',
      description: 'desc',
      actionsTaken: null
    } as const
    service.createReport.mockResolvedValue(baseReport)

    const result = await controller.createReport(payload, 'u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.createReport).toHaveBeenCalledWith(payload, 'u1')
    expect(result).toBe(baseReport)
  })

  it('cancelReport passes ids', async () => {
    service.cancelReport.mockResolvedValue(baseReport)

    const result = await controller.cancelReport({ reportId: 'r1' }, 'u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.cancelReport).toHaveBeenCalledWith('r1', 'u1')
    expect(result).toBe(baseReport)
  })

  it('acknowledgeReport passes ids', async () => {
    service.acknowledgeReport.mockResolvedValue(baseReport)

    const result = await controller.acknowledgeReport({ reportId: 'r1' }, 'u2')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.acknowledgeReport).toHaveBeenCalledWith('r1', 'u2')
    expect(result).toBe(baseReport)
  })

  it('respondToReport passes body and ids', async () => {
    const response = { response: 'Done' } as const
    service.respondToReport.mockResolvedValue(baseReport)

    const result = await controller.respondToReport({ reportId: 'r1' }, response, 'manager-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.respondToReport).toHaveBeenCalledWith('r1', response, 'manager-1')
    expect(result).toBe(baseReport)
  })
})
