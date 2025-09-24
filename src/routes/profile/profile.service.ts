import { BadRequestException, Injectable } from '@nestjs/common'
import { ResetPasswordBodyType, UpdateProfileBodyType } from '~/routes/profile/profile.model'
import { UserNotFoundException } from '~/routes/user/user.error'
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
        throw new BadRequestException('Cannot update trainer profile: user is not a trainer')
      }

      if (traineeProfile && currentUser.role.name !== RoleName.TRAINEE) {
        throw new BadRequestException('Cannot update trainee profile: user is not a trainee')
      }

      // Ensure only the correct profile type is provided
      if (currentUser.role.name === RoleName.TRAINER && traineeProfile) {
        throw new BadRequestException('Trainer cannot have trainee profile data')
      }

      if (currentUser.role.name === RoleName.TRAINEE && trainerProfile) {
        throw new BadRequestException('Trainee cannot have trainer profile data')
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
        throw new BadRequestException('Email already exists')
      }
      throw error
    }
  }

  async resetPassword({ userId, body }: { userId: string; body: Omit<ResetPasswordBodyType, 'confirmNewPassword'> }) {
    try {
      const { newPassword } = body
      const user = await this.sharedUserRepository.findUnique({
        id: userId
      })
      if (!user) {
        throw UserNotFoundException
      }

      const hashedPassword = await this.hashingService.hashPassword(newPassword)

      await this.sharedUserRepository.update(
        { id: userId },
        {
          passwordHash: hashedPassword,
          updatedById: userId
        }
      )
      return {
        message: 'Password reset successfully'
      }
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }
}
