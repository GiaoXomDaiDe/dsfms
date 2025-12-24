import { Test, TestingModule } from '@nestjs/testing'
import { ProfileController } from '~/routes/profile/profile.controller'
import { ProfileMes } from '~/routes/profile/profile.message'
import type { ResetPasswordBodyType, UpdateSignatureBodyType } from '~/routes/profile/profile.model'
import { ProfileService } from '~/routes/profile/profile.service'
import type { GetUserResType } from '~/routes/user/user.model'

jest.mock('~/routes/profile/profile.service')

describe('ProfileController', () => {
  let controller: ProfileController
  let service: jest.Mocked<ProfileService>

  const baseUser: GetUserResType = {
    id: 'u1',
    eid: 'E01',
    firstName: 'John',
    lastName: 'Doe',
    middleName: null,
    address: null,
    email: 'john@example.com',
    gender: 'MALE',
    phoneNumber: null,
    avatarUrl: 'https://example.com/avatar.png',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [ProfileService]
    }).compile()

    controller = module.get(ProfileController)
    service = module.get(ProfileService)
    jest.clearAllMocks()
  })

  it('getProfile returns message + data', async () => {
    service.getProfile.mockResolvedValue(baseUser)

    const result = await controller.getProfile('u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.getProfile).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ message: ProfileMes.DETAIL_SUCCESS, data: baseUser })
  })

  it('updateAvatar wraps response', async () => {
    const updated = { ...baseUser, avatarUrl: 'https://cdn/avatar.png' }
    service.updateAvatar.mockResolvedValue(updated)

    const result = await controller.updateAvatar(undefined, { avatarUrl: updated.avatarUrl }, 'u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.updateAvatar).toHaveBeenCalledWith({
      userId: 'u1',
      avatarFile: undefined,
      avatarUrl: updated.avatarUrl
    })
    expect(result).toEqual({ message: ProfileMes.UPDATE_SUCCESS, data: updated })
  })

  it('resetPassword returns service result', async () => {
    service.resetPassword.mockResolvedValue({ message: 'ok' })

    const resetBody: ResetPasswordBodyType = {
      oldPassword: 'old',
      newPassword: 'new',
      confirmNewPassword: 'new'
    }
    const result = await controller.resetPassword(resetBody, 'u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.resetPassword).toHaveBeenCalledWith({ userId: 'u1', body: expect.any(Object) })
    expect(result).toEqual({ message: 'ok' })
  })

  it('updateSignature returns wrapped data', async () => {
    service.updateSignature.mockResolvedValue({ message: 'done', signatureImageUrl: 'http://img/sign.png' })

    const signatureBody: UpdateSignatureBodyType = { signatureImageUrl: 'http://img/sign.png' }

    const result = await controller.updateSignature(signatureBody, 'u1')

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.updateSignature).toHaveBeenCalledWith({ userId: 'u1', signatureImageUrl: 'http://img/sign.png' })
    expect(result).toEqual({
      success: true,
      message: 'done',
      data: { signatureImageUrl: 'http://img/sign.png' }
    })
  })
})
