import { Module } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { SubjectModule } from '../subject/subject.module'
import { CourseController } from './course.controller'
import { CourseRepository } from './course.repo'
import { CourseService } from './course.service'

@Module({
  imports: [SubjectModule],
  controllers: [CourseController],
  providers: [CourseService, CourseRepository, PrismaService],
  exports: [CourseService, CourseRepository]
})
export class CourseModule {}
