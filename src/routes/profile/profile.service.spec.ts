import { BadRequestException } from '@nestjs/common'
import { Readable } from 'stream'
import {
  AvatarInvalidFormatException,
  AvatarSourceMissingException,
  OldPasswordIncorrectException,
  ProfileNotAccessibleException,
  UserNotFoundException
} from '~/routes/profile/profile.error'
import { ProfileMes } from '~/routes/profile/profile.message'
import type { ResetPasswordBodyType } from '~/routes/profile/profile.model'
import { ProfileService } from '~/routes/profile/profile.service'
import type { GetUserResType } from '~/routes/user/user.model'
import { UserStatus } from '~/shared/constants/auth.constant'
import type { MessageResType } from '~/shared/models/response.model'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { HashingService } from '~/shared/services/hashing.service'
import { S3Service } from '~/shared/services/s3.service'

describe('ProfileService', () => {
  let service: ProfileService
  let sharedUserRepository: jest.Mocked<SharedUserRepository>
  let hashingService: jest.Mocked<HashingService>
  let s3Service: jest.Mocked<S3Service>

  type UserRecord = NonNullable<Awaited<ReturnType<SharedUserRepository['findUnique']>>>

  const baseProfileUser: GetUserResType = {
    id: 'u1',
    eid: 'EID-1',
    firstName: 'Jane',
    lastName: 'Doe',
    middleName: null,
    address: null,
    email: 'jane@example.com',
    gender: 'FEMALE',
    phoneNumber: null,
    avatarUrl: 'https://example.com/avatar.png',
    status: UserStatus.ACTIVE,
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

  const baseUserRecord: UserRecord = {
    id: 'u1',
    eid: 'EID-1',
    firstName: 'Jane',
    lastName: 'Doe',
    middleName: null,
    address: null,
    email: 'jane@example.com',
    gender: 'FEMALE',
    phoneNumber: null,
    avatarUrl: 'https://example.com/avatar.png',
    status: UserStatus.ACTIVE,
    signatureImageUrl: null,
    createdById: null,
    updatedById: null,
    deletedById: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleId: 'r1',
    departmentId: null,
    passwordHash: 'hashed-old'
  }

  beforeEach(() => {
    sharedUserRepository = {
      findUniqueIncludeProfile: jest.fn(),
      updateWithProfile: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    } as unknown as jest.Mocked<SharedUserRepository>

    hashingService = {
      comparePassword: jest.fn(),
      hashPassword: jest.fn()
    } as unknown as jest.Mocked<HashingService>

    s3Service = {
      uploadBuffer: jest.fn(),
      getObjectUrl: jest.fn()
    } as unknown as jest.Mocked<S3Service>

    service = new ProfileService(sharedUserRepository, hashingService, s3Service)
  })

  describe('getProfile', () => {
    it('returns profile when accessible', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue(baseProfileUser)

      const result = await service.getProfile('u1')

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(sharedUserRepository.findUniqueIncludeProfile).toHaveBeenCalledWith('u1')
      expect(result).toEqual(baseProfileUser)
    })

    it('throws when profile not accessible', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue({ ...baseProfileUser, deletedAt: new Date() })

      await expect(service.getProfile('u1')).rejects.toBe(ProfileNotAccessibleException)
    })
  })

  describe('updateAvatar', () => {
    const avatarFile: Express.Multer.File = {
      buffer: Buffer.from('img'),
      mimetype: 'image/png',
      originalname: 'avatar.png',
      fieldname: 'avatar',
      size: 3,
      stream: new Readable(),
      destination: undefined as unknown as string,
      encoding: '7bit',
      filename: 'avatar.png',
      path: undefined as unknown as string
    }

    it('throws when no avatar source provided', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue(baseProfileUser)

      await expect(service.updateAvatar({ userId: 'u1' })).rejects.toBe(AvatarSourceMissingException)
    })

    it('throws when avatar file invalid format', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue(baseProfileUser)

      await expect(
        service.updateAvatar({ userId: 'u1', avatarFile: { ...avatarFile, mimetype: 'text/plain' } })
      ).rejects.toBe(AvatarInvalidFormatException)
    })

    it('uploads avatar file and updates user', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue(baseProfileUser)
      s3Service.uploadBuffer.mockResolvedValue({ key: 'profiles/avatars/u1/new.png', url: 'https://cdn/new.png' })
      sharedUserRepository.updateWithProfile.mockResolvedValue({ ...baseProfileUser, avatarUrl: 'https://cdn/new.png' })

      const result = await service.updateAvatar({ userId: 'u1', avatarFile })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(s3Service.uploadBuffer).toHaveBeenCalled()
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(sharedUserRepository.updateWithProfile).toHaveBeenCalledWith(
        { id: 'u1' },
        {
          updatedById: 'u1',
          userData: { avatarUrl: 'https://cdn/new.png' },
          newRoleName: baseProfileUser.role.name
        }
      )
      expect(result.avatarUrl).toBe('https://cdn/new.png')
    })

    it('uses avatarUrl when provided', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue(baseProfileUser)
      sharedUserRepository.updateWithProfile.mockResolvedValue({ ...baseProfileUser, avatarUrl: 'https://img/url.png' })

      const result = await service.updateAvatar({ userId: 'u1', avatarUrl: 'https://img/url.png' })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(sharedUserRepository.updateWithProfile).toHaveBeenCalledWith(
        { id: 'u1' },
        {
          updatedById: 'u1',
          userData: { avatarUrl: 'https://img/url.png' },
          newRoleName: baseProfileUser.role.name
        }
      )
      expect(result.avatarUrl).toBe('https://img/url.png')
    })

    it('throws when profile disabled', async () => {
      sharedUserRepository.findUniqueIncludeProfile.mockResolvedValue({
        ...baseProfileUser,
        status: UserStatus.DISABLED
      })

      await expect(service.updateAvatar({ userId: 'u1', avatarUrl: 'https://img/url.png' })).rejects.toBe(
        ProfileNotAccessibleException
      )
    })
  })

  describe('resetPassword', () => {
    const resetBody: ResetPasswordBodyType = {
      oldPassword: 'old',
      newPassword: 'new',
      confirmNewPassword: 'new'
    }

    it('throws when confirmation mismatches', async () => {
      await expect(
        service.resetPassword({ userId: 'u1', body: { ...resetBody, confirmNewPassword: 'diff' } })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws when user not accessible', async () => {
      sharedUserRepository.findUnique.mockResolvedValue({ ...baseUserRecord, status: UserStatus.DISABLED })

      await expect(service.resetPassword({ userId: 'u1', body: resetBody })).rejects.toBe(ProfileNotAccessibleException)
    })

    it('throws when old password incorrect', async () => {
      sharedUserRepository.findUnique.mockResolvedValue(baseUserRecord)
      hashingService.comparePassword.mockResolvedValue(false)

      await expect(service.resetPassword({ userId: 'u1', body: resetBody })).rejects.toBe(OldPasswordIncorrectException)
    })

    it('updates password when valid', async () => {
      sharedUserRepository.findUnique.mockResolvedValue(baseUserRecord)
      hashingService.comparePassword.mockResolvedValue(true)
      hashingService.hashPassword.mockResolvedValue('hashed-new')

      const result = await service.resetPassword({ userId: 'u1', body: resetBody })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(sharedUserRepository.update).toHaveBeenCalledWith(
        { id: 'u1' },
        { passwordHash: 'hashed-new', updatedById: 'u1' }
      )
      expect(result).toEqual<MessageResType>({ message: ProfileMes.RESET_PASSWORD_SUCCESS })
    })
  })

  describe('updateSignature', () => {
    it('throws when user not found', async () => {
      sharedUserRepository.findUnique.mockResolvedValue(null)

      await expect(service.updateSignature({ userId: 'u1', signatureImageUrl: 'http://img/sign.png' })).rejects.toBe(
        UserNotFoundException
      )
    })

    it('updates signature when user exists', async () => {
      sharedUserRepository.findUnique.mockResolvedValue(baseUserRecord)

      const result = await service.updateSignature({ userId: 'u1', signatureImageUrl: 'http://img/sign.png' })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(sharedUserRepository.update).toHaveBeenCalledWith(
        { id: 'u1' },
        {
          signatureImageUrl: 'http://img/sign.png',
          updatedById: 'u1'
        }
      )
      expect(result).toEqual({ message: ProfileMes.UPDATE_SIGNATURE_SUCCESS, signatureImageUrl: 'http://img/sign.png' })
    })
  })
})
