import { Injectable } from '@nestjs/common'
import {
  CannotUpdateTrainerProfileException,
  EmailAlreadyExistsException,
  OldPasswordIncorrectException,
  PasswordResetSuccessException,
  TraineeCannotHaveTrainerProfileException,
  UserNotFoundException
} from '~/routes/profile/profile.error'
import { ResetPasswordBodyType, UpdateProfileBodyType, UpdateSignatureBodyType } from '~/routes/profile/profile.model'
import type { GetUserProfileResType } from '~/routes/user/user.model'
import type { RoleNameType } from '~/shared/constants/auth.constant'
import { RoleName } from '~/shared/constants/auth.constant'
import { isUniqueConstraintPrismaError } from '~/shared/helper'
import type { MessageResType } from '~/shared/models/response.model'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { HashingService } from '~/shared/services/hashing.service'

@Injectable()
export class ProfileService {
  constructor(
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly hashingService: HashingService
  ) {}

  async getProfile(userId: string): Promise<GetUserProfileResType> {
    const user = await this.sharedUserRepository.findUniqueIncludeProfile(userId)

    if (!user) {
      throw UserNotFoundException
    }
    return user
  }

  async updateProfile({
    userId,
    body
  }: {
    userId: string
    body: UpdateProfileBodyType
  }): Promise<GetUserProfileResType> {
    try {
      const currentUser = await this.sharedUserRepository.findUniqueIncludeProfile(userId)
      if (!currentUser) {
        throw UserNotFoundException
      }

      const { trainerProfile, avatarUrl } = body

      const userBasicInfo: Pick<UpdateProfileBodyType, 'avatarUrl'> = {}
      if (typeof avatarUrl !== 'undefined') {
        userBasicInfo.avatarUrl = avatarUrl
      }

      if (trainerProfile && currentUser.role.name !== RoleName.TRAINER) {
        if (currentUser.role.name === RoleName.TRAINEE) {
          throw TraineeCannotHaveTrainerProfileException
        }
        throw CannotUpdateTrainerProfileException
      }

      const updated = await this.sharedUserRepository.updateWithProfile(
        { id: userId },
        {
          updatedById: userId,
          userData: userBasicInfo,
          newRoleName: currentUser.role.name as RoleNameType,
          trainerProfile: currentUser.role.name === RoleName.TRAINER ? trainerProfile : undefined
        }
      )

      return updated
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw EmailAlreadyExistsException
      }
      throw error
    }
  }

  async resetPassword({
    userId,
    body
  }: {
    userId: string
    body: Omit<ResetPasswordBodyType, 'confirmNewPassword'>
  }): Promise<MessageResType> {
    const { oldPassword, newPassword } = body

    const user = await this.sharedUserRepository.findUnique({
      id: userId
    })
    if (!user) {
      throw UserNotFoundException
    }

    const isOldPasswordValid = await this.hashingService.comparePassword(oldPassword, user.passwordHash)
    if (!isOldPasswordValid) {
      throw OldPasswordIncorrectException
    }

    const hashedPassword = await this.hashingService.hashPassword(newPassword)

    await this.sharedUserRepository.update(
      { id: userId },
      {
        passwordHash: hashedPassword,
        updatedById: userId
      }
    )

    return PasswordResetSuccessException
  }

  async updateSignature({
    userId,
    signatureImageUrl
  }: {
    userId: string
    signatureImageUrl: string
  }): Promise<{ message: string; signatureImageUrl: string }> {
    // Check if user exists
    const user = await this.sharedUserRepository.findUnique({ id: userId })
    if (!user) {
      throw UserNotFoundException
    }

    // Update signature image URL
    await this.sharedUserRepository.update(
      { id: userId },
      {
        signatureImageUrl,
        updatedById: userId
      }
    )

    return {
      message: 'Signature updated successfully',
      signatureImageUrl
    }
  }
}
