import { Injectable } from '@nestjs/common'
import {
  AvatarInvalidFormatException,
  AvatarSourceMissingException,
  AvatarUploadFailedException,
  EmailAlreadyExistsException,
  OldPasswordIncorrectException,
  ProfileNotAccessibleException,
  UserNotFoundException
} from '~/routes/profile/profile.error'
import { ProfileMes } from '~/routes/profile/profile.message'
import { ResetPasswordBodyType, UpdateProfileBodyType } from '~/routes/profile/profile.model'
import { GetUserResType } from '~/routes/user/user.model'
import type { RoleNameType } from '~/shared/constants/auth.constant'
import { UserStatus } from '~/shared/constants/auth.constant'
import { generateRandomFilename, isUniqueConstraintPrismaError } from '~/shared/helper'
import type { MessageResType } from '~/shared/models/response.model'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { HashingService } from '~/shared/services/hashing.service'
import { S3Service } from '~/shared/services/s3.service'

@Injectable()
export class ProfileService {
  constructor(
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly hashingService: HashingService,
    private readonly s3Service: S3Service
  ) {}

  async getProfile(userId: string): Promise<GetUserResType> {
    const user = await this.sharedUserRepository.findUniqueIncludeProfile(userId)

    if (!user || user.deletedAt || user.status === UserStatus.DISABLED) {
      throw ProfileNotAccessibleException
    }
    return user
  }

  async updateAvatar({
    userId,
    avatarFile,
    avatarUrl
  }: {
    userId: string
    avatarFile?: Express.Multer.File
    avatarUrl?: UpdateProfileBodyType['avatarUrl']
  }): Promise<GetUserResType> {
    try {
      const currentUser = await this.sharedUserRepository.findUniqueIncludeProfile(userId)
      if (!currentUser || currentUser.deletedAt || currentUser.status === UserStatus.DISABLED) {
        throw ProfileNotAccessibleException
      }

      if (!avatarFile && !avatarUrl) {
        throw AvatarSourceMissingException
      }

      let resolvedAvatarUrl = avatarUrl

      if (avatarFile) {
        resolvedAvatarUrl = await this.uploadAvatarToS3({
          file: avatarFile,
          userId
        })
      }

      if (!resolvedAvatarUrl) {
        throw AvatarSourceMissingException
      }

      const updated = await this.sharedUserRepository.updateWithProfile(
        { id: userId },
        {
          updatedById: userId,
          userData: {
            avatarUrl: resolvedAvatarUrl
          },
          newRoleName: currentUser.role.name as RoleNameType
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
    if (!user || user.deletedAt || user.status === UserStatus.DISABLED) {
      throw ProfileNotAccessibleException // hoặc 1 exception riêng cho auth
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

    return {
      message: ProfileMes.RESET_PASSWORD_SUCCESS
    }
  }

  private async uploadAvatarToS3({ file, userId }: { file: Express.Multer.File; userId: string }): Promise<string> {
    if (!file.mimetype?.startsWith('image/')) {
      throw AvatarInvalidFormatException
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw AvatarInvalidFormatException
    }

    const filename = file.originalname && file.originalname.includes('.') ? file.originalname : 'avatar.png'
    const key = `profiles/avatars/${userId}/${generateRandomFilename(filename)}`

    try {
      const uploadResult = await this.s3Service.uploadBuffer({
        key,
        body: file.buffer,
        contentType: file.mimetype
      })

      return uploadResult.url ?? this.s3Service.getObjectUrl(key)
    } catch (error) {
      throw AvatarUploadFailedException
    }
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
      message: ProfileMes.UPDATE_SIGNATURE_SUCCESS,
      signatureImageUrl
    }
  }
}
