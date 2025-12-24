import { Test, TestingModule } from '@nestjs/testing'
import { PermissionGroupController } from './permission-group.controller'
import { PermissionGroupMes } from './permission-group.message'
import type {
  AssignPermissionGroupPermissionsBodyType,
  CreatePermissionGroupBodyType,
  PermissionGroupDetailType,
  PermissionGroupType,
  UpdatePermissionGroupBodyType
} from './permission-group.model'
import { PermissionGroupService } from './permission-group.service'

describe('PermissionGroupController', () => {
  let controller: PermissionGroupController
  let service: PermissionGroupService
  let serviceMock: jest.Mocked<PermissionGroupService>

  const baseGroup: PermissionGroupType = {
    id: 'g1',
    groupName: 'Feature A',
    name: 'Group A',
    permissionGroupCode: 'PG-001'
  }

  const detail: PermissionGroupDetailType = {
    ...baseGroup,
    permissionCount: 1,
    permissions: [
      {
        id: 'p1',
        name: 'perm',
        method: 'GET',
        path: '/path',
        module: 'module',
        description: null,
        viewModule: null,
        viewName: null
      }
    ]
  }

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<PermissionGroupService>> = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      assignPermissions: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionGroupController],
      providers: [{ provide: PermissionGroupService, useValue: mockService }]
    }).compile()

    controller = module.get(PermissionGroupController)
    service = module.get(PermissionGroupService)
    serviceMock = service as jest.Mocked<PermissionGroupService>
    jest.clearAllMocks()
  })

  it('creates permission group', async () => {
    const body: CreatePermissionGroupBodyType = {
      groupName: 'Feature A',
      name: 'Group A',
      permissionGroupCode: 'PG-001'
    }
    serviceMock.create.mockResolvedValue(baseGroup)

    const result = await controller.create(body)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(serviceMock.create).toHaveBeenCalledWith(body)
    expect(result).toEqual({ message: PermissionGroupMes.CREATE_SUCCESS, data: baseGroup })
  })

  it('lists permission groups', async () => {
    const listData = [{ featureGroup: 'Feature A', permissions: [{ code: 'PG-001', name: 'Group A' }] }]
    serviceMock.list.mockResolvedValue(listData)

    const result = await controller.findAll()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(serviceMock.list).toHaveBeenCalled()
    expect(result).toEqual({ message: PermissionGroupMes.LIST_SUCCESS, data: listData })
  })

  it('gets permission group detail', async () => {
    serviceMock.findOne.mockResolvedValue(detail)

    const result = await controller.findOne({ permissionGroupId: 'g1' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(serviceMock.findOne).toHaveBeenCalledWith('g1')
    expect(result).toEqual({ message: PermissionGroupMes.DETAIL_SUCCESS, data: detail })
  })

  it('updates permission group', async () => {
    const body: UpdatePermissionGroupBodyType = { name: 'Updated' }

    const result = await controller.update({ permissionGroupId: 'g1' }, body)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(serviceMock.update).toHaveBeenCalledWith('g1', body)
    expect(result).toEqual({ message: PermissionGroupMes.UPDATE_SUCCESS })
  })

  it('removes permission group', async () => {
    const result = await controller.remove({ permissionGroupId: 'g1' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(serviceMock.remove).toHaveBeenCalledWith('g1')
    expect(result).toEqual({ message: PermissionGroupMes.DELETE_SUCCESS })
  })

  it('assigns permissions', async () => {
    const body: AssignPermissionGroupPermissionsBodyType = { permissionIds: ['p1', 'p2'] }
    serviceMock.assignPermissions.mockResolvedValue(detail)

    const result = await controller.assignPermissions({ permissionGroupId: 'g1' }, body)

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(serviceMock.assignPermissions).toHaveBeenCalledWith('g1', body)
    expect(result).toEqual({ message: PermissionGroupMes.ASSIGN_SUCCESS, data: detail })
  })
})
