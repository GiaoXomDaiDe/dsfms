import { Injectable } from '@nestjs/common'
import {
  CannotUpdateTraineeProfileException,
  CannotUpdateTrainerProfileException,
  EmailAlreadyExistsException,
  OldPasswordIncorrectException,
  PasswordResetSuccessException,
  TraineeCannotHaveTrainerProfileException,
  TrainerCannotHaveTraineeProfileException,
  UserNotFoundException
} from '~/routes/profile/profile.error'
import { ResetPasswordBodyType, UpdateProfileBodyType } from '~/routes/profile/profile.model'
import { RoleName } from '~/shared/constants/auth.constant'
import { isUniqueConstraintPrismaError } from '~/shared/helper'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { HashingService } from '~/shared/services/hashing.service'

@Injectable()
export class ProfileService {
  constructor(
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly hashingService: HashingService
  ) {}

  async getProfile(userId: string) {
    const user = await this.sharedUserRepository.findUniqueIncludeProfile({ id: userId })

    if (!user) {
      throw UserNotFoundException
    }
    return user
  }

  async updateProfile({ userId, body }: { userId: string; body: UpdateProfileBodyType }) {
    try {
      const currentUser = await this.sharedUserRepository.findUniqueIncludeProfile({ id: userId })
      if (!currentUser) {
        throw UserNotFoundException
      }

      const { trainerProfile, traineeProfile, ...userBasicInfo } = body

      // Validate profile data based on current user role
      if (trainerProfile && currentUser.role.name !== RoleName.TRAINER) {
        throw CannotUpdateTrainerProfileException
      }

      if (traineeProfile && currentUser.role.name !== RoleName.TRAINEE) {
        throw CannotUpdateTraineeProfileException
      }

      // Ensure only the correct profile type is provided
      if (currentUser.role.name === RoleName.TRAINER && traineeProfile) {
        throw TrainerCannotHaveTraineeProfileException
      }

      if (currentUser.role.name === RoleName.TRAINEE && trainerProfile) {
        throw TraineeCannotHaveTrainerProfileException
      }

      return await this.sharedUserRepository.updateWithProfile(
        { id: userId },
        {
          updatedById: userId,
          userData: userBasicInfo,
          newRoleName: currentUser.role.name, // Keep current role, no role change
          trainerProfile: currentUser.role.name === RoleName.TRAINER ? trainerProfile : undefined,
          traineeProfile: currentUser.role.name === RoleName.TRAINEE ? traineeProfile : undefined
        }
      )
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw EmailAlreadyExistsException
      }
      throw error
    }
  }

  async resetPassword({ userId, body }: { userId: string; body: Omit<ResetPasswordBodyType, 'confirmNewPassword'> }) {
    const { oldPassword, newPassword } = body

    // Tìm user hiện tại
    const user = await this.sharedUserRepository.findUnique({
      id: userId
    })
    if (!user) {
      throw UserNotFoundException
    }

    // Validate mật khẩu cũ có đúng không
    const isOldPasswordValid = await this.hashingService.comparePassword(oldPassword, user.passwordHash)
    if (!isOldPasswordValid) {
      throw OldPasswordIncorrectException
    }

    // Hash mật khẩu mới và cập nhật
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
}
