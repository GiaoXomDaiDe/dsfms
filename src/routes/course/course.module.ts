import { Module } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { SubjectModule } from '../subject/subject.module'
import { CourseController } from './course.controller'
import { CourseRepo } from './course.repo'
import { CourseService } from './course.service'

@Module({
  imports: [SubjectModule],
  controllers: [CourseController],
  providers: [CourseService, CourseRepo, PrismaService],
  exports: [CourseService, CourseRepo]
})
export class CourseModule {}
