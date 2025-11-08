import { Module } from '@nestjs/common'
import { AssessmentController } from './assessment.controller'
import { AssessmentService } from './assessment.service'
import { AssessmentRepo } from './assessment.repo'
import { NodemailerService } from '../email/nodemailer.service'

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentService, AssessmentRepo, NodemailerService],
  exports: [AssessmentService, AssessmentRepo]
})
export class AssessmentModule {}