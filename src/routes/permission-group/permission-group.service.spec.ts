import { NotFoundException } from '@nestjs/common'
import { HttpMethod } from '@prisma/client'
import { SharedPermissionRepository } from '~/shared/repositories/shared-permission.repo'
import { mapPermissionGroups } from '~/shared/utils/permission-group.util'
import type {
  AssignPermissionGroupPermissionsBodyType,
  PermissionGroupDetailType,
  PermissionGroupType
} from './permission-group.model'
import { PermissionGroupRepo } from './permission-group.repo'
import { PermissionGroupService } from './permission-group.service'

jest.mock('~/shared/utils/permission-group.util', () => ({
  mapPermissionGroups: jest.fn()
}))

describe('PermissionGroupService', () => {
  let service: PermissionGroupService
  let repo: jest.Mocked<PermissionGroupRepo>
  let sharedPermissionRepo: jest.Mocked<SharedPermissionRepository>
  const mockedMapPermissionGroups = mapPermissionGroups as jest.MockedFunction<typeof mapPermissionGroups>

  const baseGroup: PermissionGroupType = {
    id: 'g1',
    groupName: 'Feature',
    name: 'Group',
    permissionGroupCode: 'PG-1'
  }

  const detailFromRepo = {
    ...baseGroup,
    permissions: [
      {
        endpointPermission: {
          id: 'p2',
          name: 'Beta',
          method: HttpMethod.GET,
          path: '/beta',
          module: 'module',
          description: null,
          viewModule: null,
          viewName: null
        }
      },
      {
        endpointPermission: null
      },
      {
        endpointPermission: {
          id: 'p1',
          name: 'Alpha',
          method: HttpMethod.POST,
          path: '/alpha',
          module: 'module',
          description: 'desc',
          viewModule: 'vm',
          viewName: 'vn'
        }
      }
    ]
  }

  const mappedDetail: PermissionGroupDetailType = {
    id: 'g1',
    groupName: 'Feature',
    name: 'Group',
    permissionGroupCode: 'PG-1',
    permissionCount: 2,
    permissions: [
      {
        id: 'p1',
        name: 'Alpha',
        method: HttpMethod.POST,
        path: '/alpha',
        module: 'module',
        description: 'desc',
        viewModule: 'vm',
        viewName: 'vn'
      },
      {
        id: 'p2',
        name: 'Beta',
        method: HttpMethod.GET,
        path: '/beta',
        module: 'module',
        description: null,
        viewModule: null,
        viewName: null
      }
    ]
  }

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      findDetailById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      replaceEndpointPermissions: jest.fn()
    } as unknown as jest.Mocked<PermissionGroupRepo>

    sharedPermissionRepo = {
      validatePermissionIds: jest.fn()
    } as unknown as jest.Mocked<SharedPermissionRepository>

    service = new PermissionGroupService(repo, sharedPermissionRepo)
    jest.clearAllMocks()
  })

  it('creates permission group', async () => {
    repo.create.mockResolvedValue(baseGroup)

    const result = await service.create({ groupName: 'Feature', name: 'Group', permissionGroupCode: 'PG-1' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.create).toHaveBeenCalledWith({ groupName: 'Feature', name: 'Group', permissionGroupCode: 'PG-1' })
    expect(result).toEqual(baseGroup)
  })

  it('lists permission groups with mapping', async () => {
    repo.list.mockResolvedValue([baseGroup])
    mockedMapPermissionGroups.mockReturnValue([
      { featureGroup: 'Feature', permissions: [{ code: 'PG-1', name: 'Group' }] }
    ])

    const result = await service.list()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.list).toHaveBeenCalled()
    expect(mockedMapPermissionGroups).toHaveBeenCalledWith([baseGroup])
    expect(result).toEqual([{ featureGroup: 'Feature', permissions: [{ code: 'PG-1', name: 'Group' }] }])
  })

  it('finds detailed group', async () => {
    repo.findDetailById.mockResolvedValue(detailFromRepo as never)

    const result = await service.findOne('g1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.findDetailById).toHaveBeenCalledWith('g1')
    expect(result).toEqual(mappedDetail)
  })

  it('throws not found when detail missing', async () => {
    repo.findDetailById.mockResolvedValue(null)

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('updates after ensuring existence', async () => {
    repo.findById.mockResolvedValue(baseGroup)

    await service.update('g1', { name: 'Updated' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.findById).toHaveBeenCalledWith('g1')
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.update).toHaveBeenCalledWith('g1', { name: 'Updated' })
  })

  it('throws when updating missing group', async () => {
    repo.findById.mockResolvedValue(null)

    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('deletes after ensuring existence', async () => {
    repo.findById.mockResolvedValue(baseGroup)

    await service.remove('g1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.findById).toHaveBeenCalledWith('g1')
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.delete).toHaveBeenCalledWith('g1')
  })

  it('assigns permissions with validation and deduplication', async () => {
    repo.findById.mockResolvedValue(baseGroup)
    repo.findDetailById.mockResolvedValue(detailFromRepo as never)
    const body: AssignPermissionGroupPermissionsBodyType = { permissionIds: ['p1', 'p1', 'p2'] }

    const result = await service.assignPermissions('g1', body)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(sharedPermissionRepo.validatePermissionIds).toHaveBeenCalledWith(['p1', 'p2'])
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.replaceEndpointPermissions).toHaveBeenCalledWith('g1', ['p1', 'p2'])
    expect(result).toEqual(mappedDetail)
  })

  it('skips validation when no permission ids', async () => {
    repo.findById.mockResolvedValue(baseGroup)
    repo.findDetailById.mockResolvedValue(detailFromRepo as never)
    const body: AssignPermissionGroupPermissionsBodyType = { permissionIds: [] }

    const result = await service.assignPermissions('g1', body)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(sharedPermissionRepo.validatePermissionIds).not.toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repo.replaceEndpointPermissions).toHaveBeenCalledWith('g1', [])
    expect(result).toEqual(mappedDetail)
  })
})
