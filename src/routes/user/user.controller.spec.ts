import { Test, TestingModule } from '@nestjs/testing'
import { UserController } from '~/routes/user/user.controller'
import { UserMes } from '~/routes/user/user.message'
import type {
  CreateBulkUsersBodyType,
  CreateUserBodyType,
  GetUserParamsType,
  GetUserResType,
  GetUsersResType,
  UpdateUserBodyType
} from '~/routes/user/user.model'
import { UserService } from '~/routes/user/user.service'

const mockUserService = () => ({
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  createBulk: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  enable: jest.fn()
})

describe('UserController', () => {
  let controller: UserController
  let service: ReturnType<typeof mockUserService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useFactory: mockUserService }]
    }).compile()

    controller = module.get<UserController>(UserController)
    service = module.get(UserService)

    jest.clearAllMocks()
  })

  it('list should return data with message', async () => {
    const data: GetUsersResType = { users: [], totalItems: 0 }
    service.list.mockResolvedValue(data)

    const result = await controller.list()

    expect(service.list).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ message: UserMes.LIST_SUCCESS, data })
  })

  it('findById should return detail', async () => {
    const user: GetUserResType = {
      id: 'u1',
      eid: 'E01',
      firstName: 'A',
      lastName: 'B',
      middleName: null,
      address: null,
      email: 'a@example.com',
      gender: 'MALE',
      phoneNumber: null,
      avatarUrl: null,
      status: 'ACTIVE',
      signatureImageUrl: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: { id: 'r1', name: 'ADMINISTRATOR', description: null, isActive: true },
      department: null,
      trainerProfile: null,
      traineeProfile: null,
      teachingCourses: [],
      teachingSubjects: []
    }
    service.findById.mockResolvedValue(user)

    const result = await controller.findById({ userId: 'u1' } as GetUserParamsType)

    expect(service.findById).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ message: UserMes.DETAIL_SUCCESS, data: user })
  })

  it('create should call service with creator', async () => {
    const payload: CreateUserBodyType = {
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      address: null,
      email: 'john@example.com',
      gender: 'MALE',
      phoneNumber: null,
      avatarUrl: null,
      role: { id: 'r1', name: 'ADMINISTRATOR' }
    }
    const created: GetUserResType = {
      ...payload,
      id: 'u1',
      eid: 'E01',
      status: 'ACTIVE',
      signatureImageUrl: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: { id: 'r1', name: 'ADMINISTRATOR', description: null, isActive: true },
      department: null,
      trainerProfile: null,
      traineeProfile: null,
      teachingCourses: [],
      teachingSubjects: []
    }
    service.create.mockResolvedValue(created)

    const result = await controller.create(payload, 'creator-1')

    expect(service.create).toHaveBeenCalledWith({ data: payload, createdById: 'creator-1' })
    expect(result).toEqual({ message: UserMes.CREATE_SUCCESS, data: created })
  })

  it('createBulk should return bulk response', async () => {
    const payload: CreateBulkUsersBodyType = { users: [] }
    const res = { success: [], failed: [], summary: { total: 0, successful: 0, failed: 0 } }
    service.createBulk.mockResolvedValue(res)

    const result = await controller.createBulk(payload, 'creator-1')

    expect(service.createBulk).toHaveBeenCalledWith({ data: payload, createdById: 'creator-1' })
    expect(result).toEqual({ message: UserMes.BULK_CREATE_SUCCESS, data: res })
  })

  it('update should forward params and metadata', async () => {
    const payload: UpdateUserBodyType = { firstName: 'Updated' }
    const updated: GetUserResType = {
      id: 'u1',
      eid: 'E01',
      firstName: 'Updated',
      lastName: 'Doe',
      middleName: null,
      address: null,
      email: 'john@example.com',
      gender: 'MALE',
      phoneNumber: null,
      avatarUrl: null,
      status: 'ACTIVE',
      signatureImageUrl: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: { id: 'r1', name: 'ADMINISTRATOR', description: null, isActive: true },
      department: null,
      trainerProfile: null,
      traineeProfile: null,
      teachingCourses: [],
      teachingSubjects: []
    }
    service.update.mockResolvedValue(updated)

    const result = await controller.update(payload, { userId: 'u1' } as GetUserParamsType, 'updater-1', 'ADMIN')

    expect(service.update).toHaveBeenCalledWith({
      data: payload,
      id: 'u1',
      updatedById: 'updater-1',
      updatedByRoleName: 'ADMIN'
    })
    expect(result).toEqual({ message: UserMes.UPDATE_SUCCESS, data: updated })
  })

  it('delete should call service', async () => {
    const res = { message: 'deleted' }
    service.delete.mockResolvedValue(res)

    const result = await controller.delete({ userId: 'u1' } as GetUserParamsType, 'deleter-1')

    expect(service.delete).toHaveBeenCalledWith({ id: 'u1', deletedById: 'deleter-1' })
    expect(result).toBe(res)
  })

  it('enable should call service', async () => {
    const res = { message: 'enabled' }
    service.enable.mockResolvedValue(res)

    const result = await controller.enable({ userId: 'u1' } as GetUserParamsType, 'enabler-1')

    expect(service.enable).toHaveBeenCalledWith({ id: 'u1', enabledById: 'enabler-1' })
    expect(result).toBe(res)
  })
})
