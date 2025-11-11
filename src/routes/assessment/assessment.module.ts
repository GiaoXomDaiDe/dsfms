import { Module } from '@nestjs/common'
import { AssessmentController } from './assessment.controller'
import { AssessmentService } from './assessment.service'
import { AssessmentRepo } from './assessment.repo'
import { NodemailerService } from '../email/nodemailer.service'
import { MediaService } from '../media/media.service'
import { PdfConverterService } from '~/shared/services/pdf-converter.service'
import { S3Service } from '~/shared/services/s3.service'

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentService, AssessmentRepo, NodemailerService, MediaService, PdfConverterService, S3Service],
  exports: [AssessmentService, AssessmentRepo]
})
export class AssessmentModule {}