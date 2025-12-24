import { Test, TestingModule } from '@nestjs/testing'
import { RoleController } from '~/routes/role/role.controller'
import { RoleMes } from '~/routes/role/role.message'
import { RoleService } from '~/routes/role/role.service'

jest.mock('~/routes/role/role.service')

describe('RoleController', () => {
  let controller: RoleController
  let service: jest.Mocked<RoleService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [RoleService]
    }).compile()

    controller = module.get<RoleController>(RoleController)
    service = module.get(RoleService)
    jest.clearAllMocks()
  })

  it('list returns message and data', async () => {
    const data = { roles: [], totalItems: 0 }
    service.list.mockResolvedValue(data)

    const result = await controller.list()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.list).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ message: RoleMes.LIST_SUCCESS, data })
  })

  it('findById returns message and data', async () => {
    const role = { id: 'r1' } as any
    service.findById.mockResolvedValue(role)

    const result = await controller.findById({ roleId: 'r1' })

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.findById).toHaveBeenCalledWith('r1')
    expect(result).toEqual({ message: RoleMes.DETAIL_SUCCESS, data: role })
  })

  it('create delegates to service with active user', async () => {
    const created = { id: 'new' } as any
    service.create.mockResolvedValue(created)

    const result = await controller.create({ name: 'ADMIN' } as any, 'user-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.create).toHaveBeenCalledWith({ data: { name: 'ADMIN' }, createdById: 'user-1' })
    expect(result).toEqual({ message: RoleMes.CREATE_SUCCESS, data: created })
  })

  it('update delegates to service and wraps response', async () => {
    const updated = { id: 'r1', name: 'NEW' } as any
    service.update.mockResolvedValue(updated)

    const result = await controller.update({ name: 'NEW' } as any, { roleId: 'r1' }, 'user-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.update).toHaveBeenCalledWith({ data: { name: 'NEW' }, id: 'r1', updatedById: 'user-1' })
    expect(result).toEqual({ message: RoleMes.UPDATE_SUCCESS, data: updated })
  })

  it('delete delegates to service and returns result', async () => {
    service.delete.mockResolvedValue({ message: 'ok' })

    const result = await controller.delete({ roleId: 'r1' }, 'user-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.delete).toHaveBeenCalledWith({ id: 'r1', deletedById: 'user-1' })
    expect(result).toEqual({ message: 'ok' })
  })

  it('enable delegates to service and returns result', async () => {
    service.enable.mockResolvedValue({ message: 'enabled' })

    const result = await controller.enable({ roleId: 'r1' }, 'user-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.enable).toHaveBeenCalledWith({ id: 'r1', enabledById: 'user-1' })
    expect(result).toEqual({ message: 'enabled' })
  })

  it('addPermissions delegates and wraps message', async () => {
    const data = { addedPermissions: [], addedCount: 1, summary: 'ok' }
    service.addPermissions.mockResolvedValue(data)

    const result = await controller.addPermissions({ roleId: 'r1' }, { permissionIds: ['p1'] } as any, 'user-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.addPermissions).toHaveBeenCalledWith({
      roleId: 'r1',
      permissionIds: ['p1'],
      updatedById: 'user-1'
    })
    expect(result).toEqual({ message: RoleMes.ADD_PERMISSIONS_SUCCESS, data })
  })

  it('removePermissions delegates and wraps message', async () => {
    const data = { removedPermissions: [], removedCount: 1, summary: 'ok' }
    service.removePermissions.mockResolvedValue(data)

    const result = await controller.removePermissions({ roleId: 'r1' }, { permissionIds: ['p1'] } as any, 'user-1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.removePermissions).toHaveBeenCalledWith({
      roleId: 'r1',
      permissionIds: ['p1'],
      updatedById: 'user-1'
    })
    expect(result).toEqual({ message: RoleMes.REMOVE_PERMISSIONS_SUCCESS, data })
  })
})
