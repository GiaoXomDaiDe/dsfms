import { Module } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { SubjectController } from './subject.controller'
import { SubjectRepo } from './subject.repo'
import { SubjectService } from './subject.service'

@Module({
  controllers: [SubjectController],
  providers: [SubjectService, SubjectRepo, PrismaService],
  exports: [SubjectService, SubjectRepo]
})
export class SubjectModule {}
