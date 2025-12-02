import { Module } from '@nestjs/common'
import { EmailModule } from '~/routes/email/email.module'
import { ReportsController } from '~/routes/reports/reports.controller'
import { ReportsRepository } from '~/routes/reports/reports.repo'
import { ReportsService } from '~/routes/reports/reports.service'
import { SharedModule } from '~/shared/shared.module'

@Module({
  imports: [SharedModule, EmailModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository],
  exports: [ReportsService, ReportsRepository]
})
export class ReportsModule {}
