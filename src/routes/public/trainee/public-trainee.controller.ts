import { Controller, Get } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { GetPublicTraineesResDTO } from './public-trainee.dto'
import { PublicTraineeService } from './public-trainee.service'

@Controller('public/trainees')
export class PublicTraineeController {
  constructor(private readonly publicTraineeService: PublicTraineeService) {}

  /**
   * GET /public/trainees
   * Trả về danh sách trainee đang active (public access)
   */
  @Get()
  @IsPublic()
  @ZodSerializerDto(GetPublicTraineesResDTO)
  async getAllActiveTrainees() {
    return await this.publicTraineeService.getAllActive()
  }
}
