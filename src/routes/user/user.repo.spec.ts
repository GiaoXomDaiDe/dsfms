import { UserRepository } from '~/routes/user/user.repo'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import type { PrismaService } from '~/shared/services/prisma.service'

describe('UserRepository', () => {
  const createPrismaMock = () => {
    const txUser = {
      create: jest.fn(),
      findUnique: jest.fn()
    }

    type Tx = {
      user: typeof txUser
      trainerProfile: { create: jest.Mock; createMany: jest.Mock }
      traineeProfile: { create: jest.Mock; createMany: jest.Mock }
    }

    const tx: Tx = {
      user: txUser,
      trainerProfile: { create: jest.fn(), createMany: jest.fn() },
      traineeProfile: { create: jest.fn(), createMany: jest.fn() }
    }

    const prisma = {
      user: {
        findMany: jest.fn()
      },
      $transaction: jest.fn(<T>(cb: (tx: Tx) => T) => cb(tx))
    }

    return { prisma, tx, txUser }
  }

  it('list returns users and total count', async () => {
    const { prisma } = createPrismaMock()
    const repo = new UserRepository(prisma as unknown as PrismaService)
    const users = [
      { id: '1', role: { name: RoleName.ADMINISTRATOR }, department: null, trainerProfile: null, traineeProfile: null }
    ]
    prisma.user.findMany.mockResolvedValue(users)

    const result = await repo.list()

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ users, totalItems: users.length })
  })

  it('create stores user and returns profile result', async () => {
    const { prisma, tx, txUser } = createPrismaMock()
    const repo = new UserRepository(prisma as unknown as PrismaService)
    const now = new Date()

    const created = {
      id: 'user-1',
      eid: 'E01',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      address: null,
      email: 'john@example.com',
      gender: 'MALE' as const,
      phoneNumber: null,
      avatarUrl: null,
      status: UserStatus.ACTIVE,
      signatureImageUrl: null,
      createdById: null,
      updatedById: null,
      deletedById: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      roleId: 'role-1',
      departmentId: null
    }

    const createdWithRelations = {
      ...created,
      role: { id: 'role-1', name: RoleName.ADMINISTRATOR, description: null, isActive: true },
      department: null,
      trainerProfile: null,
      traineeProfile: null
    }

    txUser.create.mockResolvedValue(created)
    txUser.findUnique.mockResolvedValue(createdWithRelations)

    const result = await repo.create({
      createdById: 'admin-1',
      userData: {
        eid: created.eid,
        firstName: created.firstName,
        lastName: created.lastName,
        middleName: created.middleName,
        address: created.address,
        email: created.email,
        gender: created.gender,
        phoneNumber: created.phoneNumber,
        avatarUrl: created.avatarUrl,
        roleId: 'role-1',
        passwordHash: 'hash'
      },
      roleName: RoleName.ADMINISTRATOR
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(txUser.create).toHaveBeenCalled()
    expect(txUser.findUnique).toHaveBeenCalledWith({
      where: { id: created.id },
      include: expect.any(Object)
    })
    expect(result).toEqual({
      id: created.id,
      eid: created.eid,
      firstName: created.firstName,
      lastName: created.lastName,
      middleName: created.middleName,
      address: created.address,
      email: created.email,
      gender: created.gender,
      phoneNumber: created.phoneNumber,
      avatarUrl: created.avatarUrl,
      status: created.status,
      signatureImageUrl: created.signatureImageUrl,
      createdById: created.createdById,
      updatedById: created.updatedById,
      deletedById: created.deletedById,
      deletedAt: created.deletedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      role: createdWithRelations.role,
      department: null,
      trainerProfile: null,
      traineeProfile: null
    })
  })
})
