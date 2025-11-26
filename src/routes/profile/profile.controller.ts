import { Body, Controller, Get, Put } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import { ResetPasswordBodyDTO, UpdateProfileBodyDTO, UpdateSignatureBodyDTO } from '~/routes/profile/profile.dto'
import { ProfileService } from '~/routes/profile/profile.service'
import { GetUserWithProfileResDTO, UpdateUserResDTO } from '~/routes/user/user.dto'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ZodSerializerDto(GetUserWithProfileResDTO)
  async getProfile(@ActiveUser('userId') userId: string) {
    const profile = await this.profileService.getProfile(userId)
    return { data: profile }
  }

  @Put()
  @ZodSerializerDto(UpdateUserResDTO)
  async updateProfile(@Body() body: UpdateProfileBodyDTO, @ActiveUser('userId') userId: string) {
    const updated = await this.profileService.updateProfile({
      userId,
      body
    })
    return { data: updated }
  }

  @Put('reset-password')
  @ZodSerializerDto(MessageResDTO)
  async resetPassword(@Body() body: ResetPasswordBodyDTO, @ActiveUser('userId') userId: string) {
    const { oldPassword, newPassword } = body
    const result = await this.profileService.resetPassword({
      userId,
      body: { oldPassword, newPassword }
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
