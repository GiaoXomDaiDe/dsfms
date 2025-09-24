import { Body, Controller, Get, Put } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import { ResetPasswordBodyDTO, UpdateProfileBodyDTO } from '~/routes/profile/profile.dto'
import { ProfileService } from '~/routes/profile/profile.service'
import { GetUserProfileResDTO, UpdateUserResDTO } from '~/routes/user/user.dto'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ZodSerializerDto(GetUserProfileResDTO)
  getProfile(@ActiveUser('userId') userId: string) {
    return this.profileService.getProfile(userId)
  }

  @Put()
  @ZodSerializerDto(UpdateUserResDTO)
  updateProfile(@Body() body: UpdateProfileBodyDTO, @ActiveUser('userId') userId: string) {
    return this.profileService.updateProfile({
      userId,
      body
    })
  }

  @Put('reset-password')
  @ZodSerializerDto(MessageResDTO)
  resetPassword(@Body() body: ResetPasswordBodyDTO, @ActiveUser('userId') userId: string) {
    return this.profileService.resetPassword({
      userId,
      body
    })
  }
}
