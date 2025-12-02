import { Body, Controller, Get, Put, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ZodSerializerDto } from 'nestjs-zod'
import { ResetPasswordBodyDTO, UpdateProfileBodyDTO, UpdateSignatureBodyDTO } from '~/routes/profile/profile.dto'
import { ProfileMes } from '~/routes/profile/profile.message'
import { ProfileService } from '~/routes/profile/profile.service'
import { GetUserResDTO, UpdateUserResDTO } from '~/routes/user/user.dto'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ZodSerializerDto(GetUserResDTO)
  async getProfile(@ActiveUser('userId') userId: string) {
    const profile = await this.profileService.getProfile(userId)
    return {
      message: ProfileMes.DETAIL_SUCCESS,
      data: profile
    }
  }

  @Put()
  @UseInterceptors(FileInterceptor('avatar'))
  @ZodSerializerDto(UpdateUserResDTO)
  async updateAvatar(
    @UploadedFile() avatarFile: Express.Multer.File | undefined,
    @Body() body: UpdateProfileBodyDTO,
    @ActiveUser('userId') userId: string
  ) {
    const updated = await this.profileService.updateAvatar({
      userId,
      avatarFile,
      avatarUrl: body?.avatarUrl
    })
    return {
      message: ProfileMes.UPDATE_SUCCESS,
      data: updated
    }
  }

  @Put('reset-password')
  @ZodSerializerDto(MessageResDTO)
  async resetPassword(@Body() body: ResetPasswordBodyDTO, @ActiveUser('userId') userId: string) {
    const result = await this.profileService.resetPassword({
      userId,
      body
    })
    return result
  }

  @Put('signature')
  @ZodSerializerDto(MessageResDTO)
  async updateSignature(@Body() body: UpdateSignatureBodyDTO, @ActiveUser('userId') userId: string) {
    const { signatureImageUrl } = body
    const result = await this.profileService.updateSignature({
      userId,
      signatureImageUrl
    })
    return {
      success: true,
      message: result.message,
      data: { signatureImageUrl: result.signatureImageUrl }
    }
  }
}
