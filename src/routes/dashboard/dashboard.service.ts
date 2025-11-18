import { Injectable } from '@nestjs/common'
import type { AcademicOverview } from './dashboard.repo'
import { DashboardRepository } from './dashboard.repo'

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getAcademicOverview(): Promise<AcademicOverview> {
    return await this.dashboardRepository.getAcademicOverview()
  }
}
