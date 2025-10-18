import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Public Course Schema - chỉ thông tin cơ bản, an toàn
export const PublicCourseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  departmentId: z.string().uuid(),
  departmentName: z.string(), // Include department name for convenience
  isActive: z.boolean().default(true)
})

// Response schemas
export const GetPublicCoursesResSchema = z.object({
  data: z.array(PublicCourseSchema),
  totalItems: z.number()
})

// DTO classes
export class PublicCourseDTO extends createZodDto(PublicCourseSchema) {}
export class GetPublicCoursesResDTO extends createZodDto(GetPublicCoursesResSchema) {}

// Types
export type PublicCourseType = z.infer<typeof PublicCourseSchema>
export type GetPublicCoursesResType = z.infer<typeof GetPublicCoursesResSchema>
