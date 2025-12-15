import { Module } from '@nestjs/common'
import { SharedSubjectEnrollmentRepository } from '~/shared/repositories/shared-subject-enrollment.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import { SubjectController } from './subject.controller'
import { SubjectRepository } from './subject.repo'
import { SubjectService } from './subject.service'

@Module({
  controllers: [SubjectController],
  providers: [SubjectService, SubjectRepository, PrismaService, SharedSubjectEnrollmentRepository],
  exports: [SubjectService, SubjectRepository]
})
export class SubjectModule {}
