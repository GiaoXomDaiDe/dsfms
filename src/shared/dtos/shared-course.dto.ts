import { createZodDto } from 'nestjs-zod'
import { CourseIdParamsSchema } from '~/shared/models/shared-course.model'

export class CourseIdParamsDto extends createZodDto(CourseIdParamsSchema) {}
