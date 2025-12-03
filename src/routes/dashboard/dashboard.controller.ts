import { Controller, Get } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import type { AcademicOverviewResType, TraineeDashboardResType } from '~/routes/dashboard/dashboard.model'
import { AcademicOverviewResDto, TraineeDashboardResDto } from './dashboard.dto'
import { DashboardService } from './dashboard.service'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('academic/overview')
  @ZodSerializerDto(AcademicOverviewResDto)
  async getAcademicOverview(): Promise<AcademicOverviewResType> {
    return await this.dashboardService.getAcademicOverview()
  }

  @Get('trainee/overview')
  @ZodSerializerDto(TraineeDashboardResDto)
  async getTraineeOverview(@ActiveUser('userId') userId: string): Promise<TraineeDashboardResType> {
    return await this.dashboardService.getTraineeOverview(userId)
  }
}
