import { Test, TestingModule } from '@nestjs/testing'
import { PermissionController } from './permission.controller'
import { PermissionService } from './permission.service'
import { PermissionMes } from './permission.message'
import type {
  CreatePermissionBodyType,
  GetPermissionDetailResType,
  UpdatePermissionBodyType
} from './permission.model'

jest.mock('./permission.service')

describe('PermissionController', () => {
  let controller: PermissionController
  let service: jest.Mocked<PermissionService>

  const basePermission: GetPermissionDetailResType = {
    id: 'p1',
    name: 'Perm',
    path: '/api',
    method: 'GET',
    module: 'mod',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: null,
    viewName: null,
    viewModule: null
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionController],
      providers: [PermissionService]
    }).compile()

    controller = module.get(PermissionController)
    service = module.get(PermissionService)
    jest.clearAllMocks()
  })

  it('lists permissions', async () => {
    service.list.mockResolvedValue({ permissions: [basePermission], totalItems: 1 })

    const result = await controller.list()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.list).toHaveBeenCalled()
    expect(result).toEqual({ message: PermissionMes.LIST_SUCCESS, data: { permissions: [basePermission], totalItems: 1 } })
  })

  it('gets permission detail', async () => {
    service.findById.mockResolvedValue(basePermission)

    const result = await controller.findById({ permissionId: 'p1' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findById).toHaveBeenCalledWith('p1')
    expect(result).toEqual({ message: PermissionMes.DETAIL_SUCCESS, data: basePermission })
  })

  it('creates permission', async () => {
    const body: CreatePermissionBodyType = {
      name: 'Perm',
      path: '/api',
      method: 'GET',
      module: 'mod',
      description: null,
      isActive: true,
      viewName: null,
      viewModule: null
    }
    service.create.mockResolvedValue(basePermission)

    const result = await controller.create(body, 'u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.create).toHaveBeenCalledWith({ data: body, createdById: 'u1' })
    expect(result).toEqual({ message: PermissionMes.CREATE_SUCCESS, data: basePermission })
  })

  it('updates permission', async () => {
    const body: UpdatePermissionBodyType = { name: 'New' }
    service.update.mockResolvedValue({ ...basePermission, name: 'New' })

    const result = await controller.update(body, { permissionId: 'p1' }, 'u2')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.update).toHaveBeenCalledWith({ data: body, id: 'p1', updatedById: 'u2' })
    expect(result).toEqual({ message: PermissionMes.UPDATE_SUCCESS, data: { ...basePermission, name: 'New' } })
  })

  it('deletes permission', async () => {
    service.delete.mockResolvedValue({ message: PermissionMes.DELETE_SUCCESS })

    const result = await controller.delete({ permissionId: 'p1' }, 'u2')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.delete).toHaveBeenCalledWith({ id: 'p1', deletedById: 'u2' })
    expect(result).toEqual({ message: PermissionMes.DELETE_SUCCESS })
  })

  it('enables permission', async () => {
    service.enable.mockResolvedValue({ message: PermissionMes.ENABLE_SUCCESS })

    const result = await controller.enable({ permissionId: 'p1' }, 'u3')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.enable).toHaveBeenCalledWith({ id: 'p1', enabledById: 'u3' })
    expect(result).toEqual({ message: PermissionMes.ENABLE_SUCCESS })
  })
})
