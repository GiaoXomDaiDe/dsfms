import { NotFoundRoleException } from '~/routes/role/role.error'
import type { CreateRoleBodyType, UpdateRoleBodyType } from '~/routes/role/role.model'
import { RoleRepo } from '~/routes/role/role.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { roleDetailInclude, roleListWithUserCountInclude } from '~/shared/prisma-presets/shared-role.prisma-presets'
import type { PrismaService } from '~/shared/services/prisma.service'

describe('RoleRepo', () => {
  const createPrisma = () => {
    const prisma = {
      role: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      endpointPermission: {
        findMany: jest.fn()
      }
    }
    return prisma
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('list maps user counts', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findMany.mockResolvedValue([
      { id: 'r1', name: 'ADMIN', _count: { users: 2 } },
      { id: 'r2', name: 'TRAINER', _count: { users: 1 } }
    ])

    const result = await repo.list()

    expect(prisma.role.findMany).toHaveBeenCalledWith({ include: roleListWithUserCountInclude })
    expect(result).toEqual({
      roles: [
        { id: 'r1', name: 'ADMIN', userCount: 2 },
        { id: 'r2', name: 'TRAINER', userCount: 1 }
      ],
      totalItems: 2
    })
  })

  it('findById returns mapped role', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findFirst.mockResolvedValue({ id: 'r1', _count: { users: 0, permissions: 1 } })

    const role = await repo.findById('r1')

    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { id: 'r1' }, include: roleDetailInclude })
    expect(role).toEqual({ id: 'r1', userCount: 0, permissionCount: 1 })
  })

  it('create connects permissions and maps counts', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    const now = new Date()
    prisma.role.create.mockResolvedValue({
      id: 'r1',
      name: RoleName.ADMINISTRATOR,
      description: null,
      permissions: [],
      createdById: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      isActive: true,
      _count: { users: 0, permissions: 0 }
    })

    const role = await repo.create({
      createdById: 'u1',
      data: {
        name: RoleName.ADMINISTRATOR,
        description: null,
        permissionGroupCodes: ['G1']
      } satisfies CreateRoleBodyType,
      permissionIds: ['p1', 'p2']
    })

    expect(prisma.role.create).toHaveBeenCalledWith({
      data: {
        name: RoleName.ADMINISTRATOR,
        description: null,
        permissions: { connect: [{ id: 'p1' }, { id: 'p2' }] },
        createdById: 'u1',
        createdAt: expect.any(Date)
      },
      include: roleDetailInclude
    })
    expect(role).toMatchObject({ id: 'r1', userCount: 0, permissionCount: 0 })
  })

  it('update with new permissions calculates connect/disconnect', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findFirst.mockResolvedValue({
      permissions: [{ id: 'p1' }, { id: 'p2' }]
    })
    prisma.role.update.mockResolvedValue({ id: 'r1', _count: { users: 0, permissions: 2 }, permissions: [] })

    const result = await repo.update({
      id: 'r1',
      updatedById: 'u1',
      data: {
        name: 'ADMIN',
        description: null,
        permissionGroupCodes: ['G1']
      } satisfies UpdateRoleBodyType,
      permissionIds: ['p2', 'p3']
    })

    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'r1', deletedAt: null, isActive: true },
      data: {
        name: 'ADMIN',
        description: null,
        permissions: {
          connect: [{ id: 'p3' }],
          disconnect: [{ id: 'p1' }]
        },
        updatedById: 'u1',
        updatedAt: expect.any(Date)
      },
      include: roleDetailInclude
    })
    expect(result).toEqual({ id: 'r1', userCount: 0, permissionCount: 2 })
  })

  it('update throws NotFoundRole when role missing', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findFirst.mockResolvedValue(null)

    await expect(
      repo.update({
        id: 'missing',
        updatedById: 'u1',
        data: {
          name: 'ADMIN',
          description: null,
          permissionGroupCodes: ['G1']
        } satisfies UpdateRoleBodyType,
        permissionIds: ['p2', 'p3']
      })
    ).rejects.toBe(NotFoundRoleException)
  })

  it('enable updates soft-deleted role', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.update.mockResolvedValue(undefined)

    await repo.enable({ id: 'r1', enabledById: 'u1' })

    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'r1', deletedAt: { not: null }, isActive: false },
      data: {
        deletedAt: null,
        deletedById: null,
        isActive: true,
        updatedById: 'u1',
        updatedAt: expect.any(Date)
      }
    })
  })

  it('addPermissions connects new ids and returns added list', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findUnique.mockResolvedValue({ permissions: [{ id: 'p1' }] })
    prisma.role.update.mockResolvedValue(undefined)
    prisma.endpointPermission.findMany.mockResolvedValue([{ id: 'p2' }])

    const result = await repo.addPermissions({ roleId: 'r1', permissionIds: ['p1', 'p2'], updatedById: 'u1' })

    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        permissions: { connect: [{ id: 'p2' }] },
        updatedById: 'u1'
      }
    })
    expect(result).toEqual({ addedPermissions: [{ id: 'p2' }] })
  })

  it('removePermissions disconnects existing ids and returns removed list', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findFirst.mockResolvedValue({ permissions: [{ id: 'p1' }, { id: 'p2' }] })
    prisma.role.update.mockResolvedValue(undefined)
    prisma.endpointPermission.findMany.mockResolvedValue([{ id: 'p1' }])

    const result = await repo.removePermissions({ roleId: 'r1', permissionIds: ['p1', 'p3'], updatedById: 'u1' })

    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        permissions: { disconnect: [{ id: 'p1' }] },
        updatedById: 'u1'
      }
    })
    expect(result).toEqual({ removedPermissions: [{ id: 'p1' }] })
  })

  it('removePermissions returns empty when none removed', async () => {
    const prisma = createPrisma()
    const repo = new RoleRepo(prisma as unknown as PrismaService)
    prisma.role.findFirst.mockResolvedValue({ permissions: [{ id: 'p1' }, { id: 'p2' }] })

    const result = await repo.removePermissions({ roleId: 'r1', permissionIds: ['p3'], updatedById: 'u1' })

    expect(result).toEqual({ removedPermissions: [] })
  })
})
