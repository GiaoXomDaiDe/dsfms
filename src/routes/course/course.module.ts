import { Module } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { CourseController } from './course.controller'
import { CourseRepo } from './course.repo'
import { CourseService } from './course.service'

@Module({
  controllers: [CourseController],
  providers: [CourseService, CourseRepo, PrismaService],
  exports: [CourseService, CourseRepo]
})
export class CourseModule {}
