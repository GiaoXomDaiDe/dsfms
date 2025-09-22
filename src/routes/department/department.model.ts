import z from 'zod'

export const DepartmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable(),
  headUserId: z.uuid().nullable(),
  isActive: z.boolean().default(true),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type DepartmentType = z.infer<typeof DepartmentSchema>
