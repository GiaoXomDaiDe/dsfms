import type {
  CreateReportBodyType,
  GetReportResType,
  GetReportsQueryType,
  RespondReportBodyType
} from '~/routes/reports/reports.model'
import { ReportsRepository } from '~/routes/reports/reports.repo'
import { ReportStatus, ReportType } from '~/shared/constants/report.constant'
import type { PrismaService } from '~/shared/services/prisma.service'

const baseUser = {
  id: 'u1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: { name: 'ADMIN' }
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

describe('ReportsRepository', () => {
  const createPrisma = () => {
    const prisma = {
      report: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      $transaction: jest.fn(async (actions: any[]) => Promise.all(actions))
    }
    return prisma
  }

  const repo = new ReportsRepository({} as unknown as PrismaService)

  it('list uses filters and returns count + items', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    const query: GetReportsQueryType = {
      requestType: undefined,
      status: ReportStatus.SUBMITTED,
      severity: undefined,
      isAnonymous: undefined
    }
    prisma.report.count.mockResolvedValue(1)
    prisma.report.findMany.mockResolvedValue([baseReport])

    const result = await repository.list(query)

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.report.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object) }))
    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object) }))
    expect(result).toEqual({ reports: [baseReport], totalItems: 1 })
  })

  it('listMe adds createdById filter', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    prisma.report.count.mockResolvedValue(0)
    prisma.report.findMany.mockResolvedValue([])

    await repository.listMe('u1', {
      requestType: undefined,
      status: undefined,
      severity: undefined,
      isAnonymous: undefined
    })

    expect(prisma.report.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdById: 'u1' }) })
    )
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdById: 'u1' }) })
    )
  })

  it('findById returns null when missing', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    prisma.report.findUnique.mockResolvedValue(null)

    const result = await repository.findById('missing')

    expect(result).toBeNull()
  })

  it('create stores report with defaults', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    const payload: CreateReportBodyType = {
      requestType: ReportType.SAFETY_REPORT,
      isAnonymous: false,
      severity: 'LOW',
      title: 'Issue',
      description: 'desc',
      actionsTaken: null
    }
    prisma.report.create.mockResolvedValue(baseReport)

    const result = await repository.create({ data: payload, createdById: 'u1' })

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestType: ReportType.SAFETY_REPORT, status: ReportStatus.SUBMITTED })
      })
    )
    expect(result).toBe(baseReport)
  })

  it('cancel updates status to CANCELLED', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    prisma.report.update.mockResolvedValue({ ...baseReport, status: ReportStatus.CANCELLED })

    const result = await repository.cancel({ id: 'r1', updatedById: 'u2' })

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'r1' }),
        data: expect.objectContaining({ status: ReportStatus.CANCELLED, updatedById: 'u2' })
      })
    )
    expect(result.status).toBe(ReportStatus.CANCELLED)
  })

  it('acknowledge updates status to ACKNOWLEDGED', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    prisma.report.update.mockResolvedValue({ ...baseReport, status: ReportStatus.ACKNOWLEDGED })

    const result = await repository.acknowledge({ id: 'r1', managedById: 'm1' })

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReportStatus.ACKNOWLEDGED, managedById: 'm1', updatedById: 'm1' })
      })
    )
    expect(result.status).toBe(ReportStatus.ACKNOWLEDGED)
  })

  it('respond updates status and response', async () => {
    const prisma = createPrisma()
    const repository = new ReportsRepository(prisma as unknown as PrismaService)
    const body: RespondReportBodyType = { response: 'ok' }
    prisma.report.update.mockResolvedValue({
      ...baseReport,
      status: ReportStatus.RESOLVED,
      response: 'ok',
      managedById: 'm1'
    })

    const result = await repository.respond({ id: 'r1', data: body, managedById: 'm1' })

    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReportStatus.RESOLVED,
          response: 'ok',
          managedById: 'm1',
          updatedById: 'm1'
        })
      })
    )
    expect(result.status).toBe(ReportStatus.RESOLVED)
  })
})
