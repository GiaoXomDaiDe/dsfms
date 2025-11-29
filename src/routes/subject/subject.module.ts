import { Module } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { SubjectController } from './subject.controller'
import { SubjectRepository } from './subject.repo'
import { SubjectService } from './subject.service'

@Module({
  controllers: [SubjectController],
  providers: [SubjectService, SubjectRepository, PrismaService],
  exports: [SubjectService, SubjectRepository]
})
export class SubjectModule {}
