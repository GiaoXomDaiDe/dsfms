import z from 'zod'
import {
  isoDateSchema,
  isoDatetimeSchema,
  nullableStringField,
  nullableUuidSchema
} from '~/shared/helpers/zod-validation.helper'
import {
  traineeNationSchema,
  traineePassportSchema,
  traineeTrainingBatchSchema,
  trainerCertificationNumberSchema,
  trainerSpecializationSchema,
  trainerYearsOfExperienceSchema
} from '~/shared/validation/profile.validation'

export const TrainerProfileSchema = z.object({
  specialization: trainerSpecializationSchema,
  certificationNumber: trainerCertificationNumberSchema,
  yearsOfExp: trainerYearsOfExperienceSchema,
  bio: nullableStringField(z.string()),
  createdById: nullableUuidSchema,
  updatedById: nullableUuidSchema,
  deletedById: nullableUuidSchema,
  deletedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema
})

export const TraineeProfileSchema = z
  .object({
    dob: isoDateSchema,
    enrollmentDate: isoDateSchema.nullable(),
    trainingBatch: traineeTrainingBatchSchema,
    passportNo: traineePassportSchema,
    nation: traineeNationSchema,
    createdById: nullableUuidSchema,
    updatedById: nullableUuidSchema,
    deletedById: nullableUuidSchema,
    deletedAt: isoDatetimeSchema.nullable(),
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema
  })
  .superRefine((data, ctx) => {
    if (data.enrollmentDate && data.enrollmentDate < data.dob) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enrollment date cannot be earlier than date of birth',
        path: ['enrollmentDate']
      })
    }
  })

export const CreateTrainerProfileSchema = TrainerProfileSchema.pick({
  specialization: true,
  certificationNumber: true,
  yearsOfExp: true,
  bio: true
})

export const CreateTraineeProfileSchema = TraineeProfileSchema.pick({
  dob: true,
  enrollmentDate: true,
  trainingBatch: true,
  passportNo: true,
  nation: true
}).superRefine((data, ctx) => {
  if (data.enrollmentDate && data.enrollmentDate < data.dob) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enrollment date cannot be earlier than date of birth',
      path: ['enrollmentDate']
    })
  }
})

export const UpdateTrainerProfileSchema = TrainerProfileSchema.pick({
  specialization: true,
  certificationNumber: true,
  yearsOfExp: true,
  bio: true
}).partial()

export const UpdateTraineeProfileSchema = TraineeProfileSchema.pick({
  dob: true,
  enrollmentDate: true,
  trainingBatch: true,
  passportNo: true,
  nation: true
})
  .partial()
  .superRefine((data, ctx) => {
    // Only validate when both dates are provided; supports partial updates.
    if (data.enrollmentDate && data.dob && data.enrollmentDate < data.dob) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enrollment date cannot be earlier than date of birth',
        path: ['enrollmentDate']
      })
    }
  })

export type TrainerProfileType = z.infer<typeof TrainerProfileSchema>
export type TraineeProfileType = z.infer<typeof TraineeProfileSchema>

export type CreateTrainerProfileType = z.infer<typeof CreateTrainerProfileSchema>
export type CreateTraineeProfileType = z.infer<typeof CreateTraineeProfileSchema>
export type UpdateTrainerProfileType = z.infer<typeof UpdateTrainerProfileSchema>
export type UpdateTraineeProfileType = z.infer<typeof UpdateTraineeProfileSchema>
