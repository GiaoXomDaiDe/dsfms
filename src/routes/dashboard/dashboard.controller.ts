import { Controller, Get } from '@nestjs/common'
import type { AcademicOverview } from './dashboard.repo'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('academic/overview')
  async getAcademicOverview(): Promise<AcademicOverview> {
    return await this.dashboardService.getAcademicOverview()
  }
}
