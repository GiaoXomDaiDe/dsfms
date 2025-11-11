import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { MediaModule } from '../media/media.module'
import { AssessmentController } from './assessment.controller'
import { AssessmentRepo } from './assessment.repo'
import { AssessmentService } from './assessment.service'

@Module({
  imports: [EmailModule, MediaModule],
  controllers: [AssessmentController],
  providers: [AssessmentService, AssessmentRepo],
  exports: [AssessmentService, AssessmentRepo]
})
export class AssessmentModule {}
