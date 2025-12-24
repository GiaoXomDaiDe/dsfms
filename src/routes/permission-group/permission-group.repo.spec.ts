import {
  permissionGroupDetailSelect,
  permissionGroupOrderBy
} from '~/shared/prisma-presets/shared-permission-group.prisma-presets'
import { PrismaService } from '~/shared/services/prisma.service'
import type {
  CreatePermissionGroupBodyType,
  PermissionGroupType,
  UpdatePermissionGroupBodyType
} from './permission-group.model'
import { PermissionGroupRepo } from './permission-group.repo'

describe('PermissionGroupRepo', () => {
  let prisma: jest.Mocked<PrismaService>
  let repo: PermissionGroupRepo

  const baseGroup: PermissionGroupType = {
    id: 'g1',
    groupName: 'Feature',
    name: 'Group',
    permissionGroupCode: 'PG-1'
  }

  beforeEach(() => {
    const permissionGroup = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }

    const permissionGroupToEndpointPermission = {
      deleteMany: jest.fn(),
      createMany: jest.fn()
    }

    const tx = {
      permissionGroupToEndpointPermission
    }

    prisma = {
      permissionGroup: permissionGroup as unknown as PrismaService['permissionGroup'],
      permissionGroupToEndpointPermission:
        permissionGroupToEndpointPermission as unknown as PrismaService['permissionGroupToEndpointPermission'],
      $transaction: jest.fn((callback) => callback(tx as unknown as PrismaService))
    } as unknown as jest.Mocked<PrismaService>

    repo = new PermissionGroupRepo(prisma)
    jest.clearAllMocks()
  })

  it('creates permission group', async () => {
    const data: CreatePermissionGroupBodyType = { groupName: 'Feature', name: 'Group', permissionGroupCode: 'PG-1' }
    ;(prisma.permissionGroup.create as jest.Mock).mockResolvedValue(baseGroup)

    const result = await repo.create(data)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.permissionGroup.create).toHaveBeenCalledWith({ data })
    expect(result).toEqual(baseGroup)
  })

  it('lists permission groups', async () => {
    ;(prisma.permissionGroup.findMany as jest.Mock).mockResolvedValue([baseGroup])

    const result = await repo.list()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.permissionGroup.findMany).toHaveBeenCalledWith({ orderBy: permissionGroupOrderBy })
    expect(result).toEqual([baseGroup])
  })

  it('finds by id', async () => {
    ;(prisma.permissionGroup.findUnique as jest.Mock).mockResolvedValue(baseGroup)

    const result = await repo.findById('g1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.permissionGroup.findUnique).toHaveBeenCalledWith({ where: { id: 'g1' } })
    expect(result).toEqual(baseGroup)
  })

  it('finds detail by id with select', async () => {
    ;(prisma.permissionGroup.findUnique as jest.Mock).mockResolvedValue(baseGroup as never)

    const result = await repo.findDetailById('g1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.permissionGroup.findUnique).toHaveBeenCalledWith({
      where: { id: 'g1' },
      select: permissionGroupDetailSelect
    })
    expect(result).toEqual(baseGroup)
  })

  it('updates permission group', async () => {
    const data: UpdatePermissionGroupBodyType = { name: 'Updated' }
    ;(prisma.permissionGroup.update as jest.Mock).mockResolvedValue({ ...baseGroup, ...data })

    const result = await repo.update('g1', data)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.permissionGroup.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data })
    expect(result).toEqual({ ...baseGroup, ...data })
  })

  it('deletes permission group', async () => {
    ;(prisma.permissionGroup.delete as jest.Mock).mockResolvedValue(baseGroup)

    const result = await repo.delete('g1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.permissionGroup.delete).toHaveBeenCalledWith({ where: { id: 'g1' } })
    expect(result).toEqual(baseGroup)
  })

  it('replaces endpoint permissions with data', async () => {
    const tx = prisma.permissionGroupToEndpointPermission as unknown as {
      deleteMany: jest.Mock
      createMany: jest.Mock
    }
    tx.deleteMany.mockResolvedValue({})
    tx.createMany.mockResolvedValue({})

    await repo.replaceEndpointPermissions('g1', ['p1', 'p2'])

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(tx.deleteMany).toHaveBeenCalledWith({ where: { permissionGroupId: 'g1' } })
    expect(tx.createMany).toHaveBeenCalledWith({
      data: [
        { permissionGroupId: 'g1', endpointPermissionId: 'p1' },
        { permissionGroupId: 'g1', endpointPermissionId: 'p2' }
      ],
      skipDuplicates: true
    })
  })

  it('replaces endpoint permissions without data skips create', async () => {
    const tx = prisma.permissionGroupToEndpointPermission as unknown as {
      deleteMany: jest.Mock
      createMany: jest.Mock
    }
    tx.deleteMany.mockResolvedValue({})
    tx.createMany.mockResolvedValue({})

    await repo.replaceEndpointPermissions('g1', [])

    expect(tx.deleteMany).toHaveBeenCalledWith({ where: { permissionGroupId: 'g1' } })
    expect(tx.createMany).not.toHaveBeenCalled()
  })
})
