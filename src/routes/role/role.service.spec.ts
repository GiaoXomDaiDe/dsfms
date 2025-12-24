import { createPermissionGroupNotFoundError, NotFoundRoleException } from '~/routes/role/role.error'
import type { CreateRoleBodyType, RoleWithPermissionsType } from '~/routes/role/role.model'
import type { RoleRepo } from '~/routes/role/role.repo'
import { RoleService } from '~/routes/role/role.service'
import type { SharedPermissionGroupRepository } from '~/shared/repositories/shared-permission-group.repo'
import type { SharedPermissionRepository } from '~/shared/repositories/shared-permission.repo'
import type { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'

jest.mock('~/shared/utils/permission-group.util', () => ({
  mapPermissionGroups: jest.fn(() => [{ name: 'Group A', permissions: [{ code: 'P1' }] }])
}))

describe('RoleService', () => {
  const roleRepo: jest.Mocked<
    Pick<
      RoleRepo,
      'list' | 'findById' | 'create' | 'update' | 'delete' | 'enable' | 'addPermissions' | 'removePermissions'
    >
  > = {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    enable: jest.fn(),
    addPermissions: jest.fn(),
    removePermissions: jest.fn()
  }

  const sharedPermissionRepo: jest.Mocked<
    Pick<SharedPermissionRepository, 'findActiveIdsByNames' | 'validatePermissionIds'>
  > = {
    findActiveIdsByNames: jest.fn(),
    validatePermissionIds: jest.fn()
  }

  const sharedRoleRepo: jest.Mocked<Pick<SharedRoleRepository, 'findById'>> = {
    findById: jest.fn()
  }

  const sharedPermissionGroupRepo: jest.Mocked<
    Pick<
      SharedPermissionGroupRepository,
      'findRoleActiveEndpointIds' | 'findAllGroupsWithActiveEndpointMappings' | 'findActivePermissionMappingsByCodes'
    >
  > = {
    findRoleActiveEndpointIds: jest.fn(),
    findAllGroupsWithActiveEndpointMappings: jest.fn(),
    findActivePermissionMappingsByCodes: jest.fn()
  }

  const service = new RoleService(
    roleRepo as unknown as RoleRepo,
    sharedPermissionRepo as unknown as SharedPermissionRepository,
    sharedRoleRepo as unknown as SharedRoleRepository,
    sharedPermissionGroupRepo as unknown as SharedPermissionGroupRepository
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('list returns repository result', async () => {
    const expected = { roles: [], totalItems: 0 }
    roleRepo.list.mockResolvedValue(expected)

    const result = await service.list()

    expect(roleRepo.list).toHaveBeenCalledTimes(1)
    expect(result).toBe(expected)
  })

  it('findById throws when missing', async () => {
    roleRepo.findById.mockResolvedValue(null)

    await expect(service.findById('missing')).rejects.toBe(NotFoundRoleException)
    expect(roleRepo.findById).toHaveBeenCalledWith('missing')
  })

  it('findById returns role with permission summary', async () => {
    const baseRole: RoleWithPermissionsType = {
      id: 'role-1',
      name: 'ADMIN',
      description: null,
      isActive: true,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissionCount: 0,
      userCount: 0
    }

    roleRepo.findById.mockResolvedValue(baseRole)
    sharedPermissionGroupRepo.findRoleActiveEndpointIds.mockResolvedValue(['p1'])
    sharedPermissionGroupRepo.findAllGroupsWithActiveEndpointMappings.mockResolvedValue([
      {
        id: 'pg-1',
        groupName: 'Group A',
        permissionGroupCode: 'G1',
        name: 'Group A',
        permissions: [{ endpointPermissionId: 'p1' }]
      }
    ])

    const result = await service.findById('role-1')

    expect(sharedPermissionGroupRepo.findRoleActiveEndpointIds).toHaveBeenCalledWith('role-1')
    expect(sharedPermissionGroupRepo.findAllGroupsWithActiveEndpointMappings).toHaveBeenCalledTimes(1)
    expect(result.permissionCount).toBe(1)
    expect(result.permissionGroups).toEqual([{ name: 'Group A', permissions: [{ code: 'P1' }] }])
    expect(result.name).toBe(baseRole.name)
  })

  it('create merges default permissions and propagates unique errors', async () => {
    const payload: CreateRoleBodyType = { name: 'ADMIN', description: null, permissionGroupCodes: ['G1'] }
    const resolvedIds = ['p-group']
    const defaultIds = ['p-default']
    sharedPermissionGroupRepo.findActivePermissionMappingsByCodes.mockResolvedValue([
      {
        id: 'pg-1',
        groupName: 'Group A',
        permissionGroupCode: 'G1',
        name: 'Group A',
        permissions: [{ endpointPermissionId: 'p-group' }]
      }
    ])
    sharedPermissionRepo.findActiveIdsByNames.mockResolvedValue(defaultIds)
    roleRepo.create.mockResolvedValue({
      id: 'new-role',
      name: payload.name,
      description: payload.description,
      isActive: true,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissionCount: 0,
      userCount: 0
    } as RoleWithPermissionsType)

    const result = await service.create({ data: payload, createdById: 'user-1' })

    expect(sharedPermissionRepo.findActiveIdsByNames).toHaveBeenCalled()
    expect(roleRepo.create).toHaveBeenCalledWith({
      createdById: 'user-1',
      data: payload,
      permissionIds: expect.arrayContaining([...resolvedIds, ...defaultIds])
    })
    expect(result).toMatchObject({ id: 'new-role' })
  })

  it('resolvePermissionIdsFromGroupCodes throws when group missing', async () => {
    sharedPermissionGroupRepo.findActivePermissionMappingsByCodes.mockResolvedValue([])

    const resolver = service as unknown as {
      resolvePermissionIdsFromGroupCodes: (codes: string[]) => Promise<string[]>
    }

    await expect(resolver.resolvePermissionIdsFromGroupCodes(['X'])).rejects.toEqual(
      createPermissionGroupNotFoundError(['X'])
    )
  })
})
