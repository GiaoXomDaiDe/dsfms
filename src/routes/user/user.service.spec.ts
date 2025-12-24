import type { NodemailerService } from '~/routes/email/nodemailer.service'
import { RoleNotFoundException, UserNotFoundException } from '~/routes/user/user.error'
import type { CreateUserBodyType, GetUserResType } from '~/routes/user/user.model'
import type { UserRepository } from '~/routes/user/user.repo'
import { UserService } from '~/routes/user/user.service'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import type { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import type { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import type { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import type { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import type { EidService } from '~/shared/services/eid.service'
import type { HashingService } from '~/shared/services/hashing.service'

jest.mock('~/shared/config', () => ({
  __esModule: true,
  default: {
    PASSWORD_SECRET: 'secret'
  }
}))

jest.mock('~/shared/helper', () => {
  const actual = jest.requireActual('~/shared/helper')
  return {
    ...actual,
    evaluateRoleProfileRules: jest.fn().mockReturnValue([])
  }
})

describe('UserService', () => {
  const hashingService: jest.Mocked<HashingService> = {
    hashPassword: jest.fn(),
    comparePassword: jest.fn()
  }
  const eidService = { generateEid: jest.fn(), isEidMatchingRole: jest.fn() }
  const nodemailerService = {
    sendNewUserAccountEmail: jest.fn(),
    sendBulkNewUserAccountEmails: jest.fn()
  }
  const userRepo = { list: jest.fn(), create: jest.fn() }
  const sharedUserRepo = { findUniqueIncludeProfile: jest.fn() }
  const sharedRoleRepo = { findById: jest.fn(), getAdminRoleId: jest.fn() }
  const sharedCourseRepo = {}
  const sharedSubjectRepo = {}

  const service = new UserService(
    hashingService as unknown as HashingService,
    eidService as unknown as EidService,
    nodemailerService as unknown as NodemailerService,
    userRepo as unknown as UserRepository,
    sharedUserRepo as unknown as SharedUserRepository,
    sharedRoleRepo as unknown as SharedRoleRepository,
    sharedCourseRepo as unknown as SharedCourseRepository,
    sharedSubjectRepo as unknown as SharedSubjectRepository
  )

  const baseUser: GetUserResType = {
    id: 'user-1',
    eid: 'E0001',
    firstName: 'John',
    lastName: 'Doe',
    middleName: null,
    address: null,
    email: 'john@example.com',
    gender: 'MALE',
    phoneNumber: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    signatureImageUrl: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: { id: 'role-1', name: RoleName.ADMINISTRATOR, description: null, isActive: true },
    department: null,
    trainerProfile: null,
    traineeProfile: null,
    teachingCourses: [],
    teachingSubjects: []
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('returns repository result', async () => {
      const expected = { users: [], totalItems: 0 }
      userRepo.list.mockResolvedValue(expected)

      const result = await service.list()

      expect(userRepo.list).toHaveBeenCalledTimes(1)
      expect(result).toBe(expected)
    })
  })

  describe('findById', () => {
    it('returns user when found', async () => {
      sharedUserRepo.findUniqueIncludeProfile.mockResolvedValue(baseUser)

      const result = await service.findById('user-1')

      expect(sharedUserRepo.findUniqueIncludeProfile).toHaveBeenCalledWith('user-1')
      expect(result).toBe(baseUser)
    })

    it('throws when missing', async () => {
      sharedUserRepo.findUniqueIncludeProfile.mockResolvedValue(null)

      await expect(service.findById('missing')).rejects.toBe(UserNotFoundException)
      expect(sharedUserRepo.findUniqueIncludeProfile).toHaveBeenCalledWith('missing')
    })
  })

  describe('create', () => {
    const createPayload: CreateUserBodyType = {
      firstName: 'Jane',
      lastName: 'Doe',
      middleName: undefined,
      address: null,
      email: 'jane@example.com',
      gender: 'FEMALE',
      phoneNumber: null,
      avatarUrl: null,
      role: { id: 'role-1', name: RoleName.ADMINISTRATOR }
    }

    it('creates user and sends email', async () => {
      const roleRecord = { id: 'role-1', name: RoleName.ADMINISTRATOR, isActive: true, deletedAt: null }
      sharedRoleRepo.findById.mockResolvedValue(roleRecord)
      eidService.generateEid.mockResolvedValue('EID123')
      hashingService.hashPassword.mockResolvedValue('hashed-pass')
      userRepo.create.mockResolvedValue({ id: 'new-id' })
      sharedUserRepo.findUniqueIncludeProfile.mockResolvedValue(baseUser)
      nodemailerService.sendNewUserAccountEmail.mockResolvedValue(undefined)

      const result = await service.create({ data: createPayload, createdById: 'admin-id' })

      expect(sharedRoleRepo.findById).toHaveBeenCalledWith('role-1')
      expect(eidService.generateEid).toHaveBeenCalledWith({ roleName: RoleName.ADMINISTRATOR })
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(hashingService.hashPassword).toHaveBeenCalledWith('EID123secret')
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdById: 'admin-id',
          roleName: RoleName.ADMINISTRATOR
        })
      )
      expect(sharedUserRepo.findUniqueIncludeProfile).toHaveBeenCalledWith('new-id')
      expect(nodemailerService.sendNewUserAccountEmail).toHaveBeenCalled()
      expect(result).toBe(baseUser)
    })

    it('throws RoleNotFoundException when role missing', async () => {
      sharedRoleRepo.findById.mockResolvedValue(null)

      await expect(service.create({ data: createPayload, createdById: 'admin-id' })).rejects.toBe(RoleNotFoundException)

      expect(userRepo.create).not.toHaveBeenCalled()
    })
  })
})
