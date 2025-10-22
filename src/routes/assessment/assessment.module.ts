import { Module } from '@nestjs/common'
import { AssessmentController } from './assessment.controller'
import { AssessmentService } from './assessment.service'
import { AssessmentRepo } from './assessment.repo'

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentService, AssessmentRepo],
  exports: [AssessmentService, AssessmentRepo]
})
export class AssessmentModule {}