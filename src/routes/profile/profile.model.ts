import z from 'zod'

export const TrainerProfileSchema = z.object({
  specialization: z.string().max(100),
  certificationNumber: z.string().max(50).nullable(),
  yearsOfExp: z.number().min(0).max(50).default(0),
  bio: z.string().max(1000).nullable(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const TraineeProfileSchema = z.object({
  dob: z.coerce.date(),
  enrollmentDate: z.coerce.date(),
  trainingBatch: z.string().max(100),
  passportNo: z.string().max(100).nullable(),
  nation: z.string().max(100),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const CreateTraineeProfileSchema = TraineeProfileSchema.pick({
  dob: true,
  enrollmentDate: true,
  trainingBatch: true,
  passportNo: true,
  nation: true
})

export const CreateTrainerProfileSchema = TrainerProfileSchema.pick({
  specialization: true,
  certificationNumber: true,
  yearsOfExp: true,
  bio: true
})

export const UpdateTrainerProfileSchema = TrainerProfileSchema.partial()
export const UpdateTraineeProfileSchema = TraineeProfileSchema.partial()

export type TrainerProfileType = z.infer<typeof TrainerProfileSchema>
export type TraineeProfileType = z.infer<typeof TraineeProfileSchema>
export type CreateTraineeProfileType = z.infer<typeof CreateTraineeProfileSchema>
export type CreateTrainerProfileType = z.infer<typeof CreateTrainerProfileSchema>
export type UpdateTrainerProfileType = z.infer<typeof UpdateTrainerProfileSchema>
export type UpdateTraineeProfileType = z.infer<typeof UpdateTraineeProfileSchema>
