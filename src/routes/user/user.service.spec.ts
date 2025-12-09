import type { NodemailerService } from '~/routes/email/nodemailer.service'
import { RoleNotFoundException, UserNotFoundException } from '~/routes/user/user.error'
import type { CreateUserBodyType, GetUserResType, GetUsersResType } from '~/routes/user/user.model'
import type { UserRepository } from '~/routes/user/user.repo'
import { UserService } from '~/routes/user/user.service'
import { GenderStatus, RoleName, UserStatus } from '~/shared/constants/auth.constant'
import type { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import type { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import type { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import type { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import type { EidService } from '~/shared/services/eid.service'
import type { HashingService } from '~/shared/services/hashing.service'

jest.mock('~/shared/helper', () => {
  const actual = jest.requireActual('~/shared/helper')
  return {
    ...actual,
    evaluateRoleProfileRules: jest.fn().mockReturnValue([])
  }
})

describe('UserService', () => {
  let hashingService: HashingService
  let hashingServiceSpy: jest.Mock
  let eidService: EidService
  let eidServiceSpy: jest.Mock
  let nodemailerService: NodemailerService
  let sendNewUserEmailSpy: jest.Mock
  let userRepo: UserRepository
  let userRepoListSpy: jest.Mock
  let userRepoCreateSpy: jest.Mock
  let sharedUserRepo: SharedUserRepository
  let findUniqueUserSpy: jest.Mock
  let sharedRoleRepo: SharedRoleRepository
  let findRoleByIdSpy: jest.Mock
  let sharedCourseRepo: SharedCourseRepository
  let sharedSubjectRepo: SharedSubjectRepository
  let service: UserService

  const sampleUserResponse = (): GetUserResType => ({
    id: 'user-1',
    eid: 'E00001',
    firstName: 'John',
    lastName: 'Doe',
    middleName: 'M',
    address: '123 Street',
    email: 'john@example.com',
    gender: GenderStatus.MALE,
    phoneNumber: '0123456789',
    avatarUrl: 'https://example.com/avatar.png',
    status: UserStatus.ACTIVE,
    signatureImageUrl: 'https://example.com/signature.png',
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: 'role-1',
      name: RoleName.TRAINEE,
      description: 'Trainee role',
      isActive: true
    },
    department: null,
    trainerProfile: null,
    traineeProfile: null,
    teachingCourses: [],
    teachingSubjects: []
  })

  const createUserPayload: CreateUserBodyType = {
    firstName: 'Jane',
    lastName: 'Doe',
    middleName: 'Q',
    address: '456 Avenue',
    email: 'jane@example.com',
    gender: GenderStatus.FEMALE,
    phoneNumber: '0987654321',
    avatarUrl: 'https://example.com/avatar.png',
    role: {
      id: 'role-1',
      name: RoleName.TRAINEE
    }
  }

  beforeEach(() => {
    hashingServiceSpy = jest.fn()
    hashingService = { hashPassword: hashingServiceSpy } as unknown as HashingService

    eidServiceSpy = jest.fn()
    eidService = { generateEid: eidServiceSpy } as unknown as EidService

    sendNewUserEmailSpy = jest.fn()
    nodemailerService = {
      sendNewUserAccountEmail: sendNewUserEmailSpy,
      sendBulkNewUserAccountEmails: jest.fn()
    } as unknown as NodemailerService

    userRepoListSpy = jest.fn()
    userRepoCreateSpy = jest.fn()
    userRepo = {
      list: userRepoListSpy,
      create: userRepoCreateSpy
    } as unknown as UserRepository

    findUniqueUserSpy = jest.fn()
    sharedUserRepo = {
      findUniqueIncludeProfile: findUniqueUserSpy
    } as unknown as SharedUserRepository

    findRoleByIdSpy = jest.fn()
    sharedRoleRepo = {
      findById: findRoleByIdSpy,
      getAdminRoleId: jest.fn()
    } as unknown as SharedRoleRepository

    sharedCourseRepo = {} as unknown as SharedCourseRepository
    sharedSubjectRepo = {} as unknown as SharedSubjectRepository

    service = new UserService(
      hashingService,
      eidService,
      nodemailerService,
      userRepo,
      sharedUserRepo,
      sharedRoleRepo,
      sharedCourseRepo,
      sharedSubjectRepo
    )

    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should return result from repository', async () => {
      const expected: GetUsersResType = { users: [], totalItems: 0 }
      userRepoListSpy.mockResolvedValue(expected)

      const result = await service.list()

      expect(userRepoListSpy).toHaveBeenCalledTimes(1)
      expect(result).toBe(expected)
    })
  })

  describe('findById', () => {
    it('should return user when found', async () => {
      const user = sampleUserResponse()
      findUniqueUserSpy.mockResolvedValue(user)

      const result = await service.findById('user-1')

      expect(findUniqueUserSpy).toHaveBeenCalledWith('user-1')
      expect(result).toBe(user)
    })

    it('should throw when user is not found', async () => {
      findUniqueUserSpy.mockResolvedValue(null)

      await expect(service.findById('missing')).rejects.toBe(UserNotFoundException)
      expect(findUniqueUserSpy).toHaveBeenCalledWith('missing')
    })
  })

  describe('create', () => {
    it('should create user, hash password, and send welcome email', async () => {
      const targetRole = {
        id: 'role-1',
        name: RoleName.TRAINEE,
        isActive: true,
        deletedAt: null
      }
      findRoleByIdSpy.mockResolvedValue(targetRole)
      eidServiceSpy.mockResolvedValue('EID001')
      hashingServiceSpy.mockResolvedValue('hashed-password')
      const createdRecord = { id: 'new-user-id' }
      userRepoCreateSpy.mockResolvedValue(createdRecord)
      const userWithProfile = sampleUserResponse()
      findUniqueUserSpy.mockResolvedValue(userWithProfile)
      sendNewUserEmailSpy.mockResolvedValue(undefined)

      const result = await service.create({ data: createUserPayload, createdById: 'admin-id' })

      expect(findRoleByIdSpy).toHaveBeenCalledWith('role-1')
      expect(eidServiceSpy).toHaveBeenCalledWith({ roleName: RoleName.TRAINEE })
      expect(hashingServiceSpy).toHaveBeenCalledWith('123')
      expect(userRepoCreateSpy).toHaveBeenCalledWith({
        createdById: 'admin-id',
        userData: expect.objectContaining({
          firstName: createUserPayload.firstName,
          passwordHash: 'hashed-password',
          eid: 'EID001'
        }),
        roleName: RoleName.TRAINEE,
        trainerProfile: undefined,
        traineeProfile: undefined
      })
      expect(findUniqueUserSpy).toHaveBeenCalledWith('new-user-id')
      expect(sendNewUserEmailSpy).toHaveBeenCalledWith(
        createUserPayload.email,
        'EID001',
        '123',
        'Jane Q Doe',
        RoleName.TRAINEE
      )
      expect(result).toBe(userWithProfile)
    })

    it('should throw RoleNotFoundException when role is missing', async () => {
      findRoleByIdSpy.mockResolvedValue(null)

      await expect(service.create({ data: createUserPayload, createdById: 'admin-id' })).rejects.toBe(
        RoleNotFoundException
      )

      expect(userRepoCreateSpy).not.toHaveBeenCalled()
    })
  })
})
