import { createZodDto } from 'nestjs-zod'
import { AcademicOverviewResSchema, TraineeDashboardResSchema } from '~/routes/dashboard/dashboard.model'

export class AcademicOverviewResDto extends createZodDto(AcademicOverviewResSchema) {}
export class TraineeDashboardResDto extends createZodDto(TraineeDashboardResSchema) {}
