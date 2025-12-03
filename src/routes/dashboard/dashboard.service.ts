import { Injectable } from '@nestjs/common'
import type { AcademicOverviewResType, TraineeDashboardResType } from '~/routes/dashboard/dashboard.model'
import { DashboardRepository } from './dashboard.repo'

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getAcademicOverview(): Promise<AcademicOverviewResType> {
    return await this.dashboardRepository.getAcademicOverview()
  }

  async getTraineeOverview(traineeId: string): Promise<TraineeDashboardResType> {
    return await this.dashboardRepository.getTraineeOverview(traineeId)
  }
}
