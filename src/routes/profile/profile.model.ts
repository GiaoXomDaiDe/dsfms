import z from 'zod'
import { isoDateSchema, isoDatetimeSchema, nullableUuidSchema } from '~/shared/helpers/zod-validation.helper'
import { UserSchema } from '~/shared/models/shared-user.model'
import {
  traineeNationSchema,
  traineePassportSchema,
  traineeTrainingBatchSchema,
  trainerBioSchema,
  trainerCertificationNumberSchema,
  trainerSpecializationSchema,
  trainerYearsOfExperienceSchema
} from '~/shared/validation/profile.validation'

export const TrainerProfileSchema = z.object({
  specialization: trainerSpecializationSchema,
  certificationNumber: trainerCertificationNumberSchema,
  yearsOfExp: trainerYearsOfExperienceSchema,
  bio: trainerBioSchema,
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
}).partial()

const TrainerSelfProfileUpdateSchema = z
  .object({
    bio: TrainerProfileSchema.shape.bio
  })
  .partial()
  .strict()

export const UpdateProfileBasicInfoSchema = UserSchema.pick({
  avatarUrl: true
})

export const UpdateProfileBodySchema = z
  .object({
    avatarUrl: UserSchema.shape.avatarUrl.optional(),
    trainerProfile: TrainerSelfProfileUpdateSchema.optional()
  })
  .strict()

export const UpdateMeBodySchema = UserSchema.pick({
  email: true,
  firstName: true,
  lastName: true,
  middleName: true,
  address: true,
  phoneNumber: true,
  avatarUrl: true,
  gender: true
}).extend({
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

export const ChangePasswordBodySchema = UserSchema.pick({
  passwordHash: true
})
  .extend({
    newPassword: z.string().min(6).max(100),
    confirmNewPassword: z.string().min(6).max(100)
  })
  .strict()
  .superRefine(({ confirmNewPassword, newPassword }, ctx) => {
    if (newPassword !== confirmNewPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'New password and confirmation do not match',
        path: ['confirmNewPassword']
      })
    }
  })

export const ResetPasswordBodySchema = z
  .object({
    oldPassword: z.string().min(6).max(100),
    newPassword: z.string().min(6).max(100),
    confirmNewPassword: z.string().min(6).max(100)
  })
  .strict()
  .superRefine(({ confirmNewPassword, newPassword }, ctx) => {
    if (newPassword !== confirmNewPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'New password and confirmation do not match',
        path: ['confirmNewPassword']
      })
    }
  })

export const UpdateSignatureBodySchema = z
  .object({
    signatureImageUrl: z.string().url('Signature image URL must be a valid URL')
  })
  .strict()

export type TrainerProfileType = z.infer<typeof TrainerProfileSchema>
export type TraineeProfileType = z.infer<typeof TraineeProfileSchema>
export type CreateTrainerProfileType = z.infer<typeof CreateTrainerProfileSchema>
export type CreateTraineeProfileType = z.infer<typeof CreateTraineeProfileSchema>
export type UpdateTrainerProfileType = z.infer<typeof UpdateTrainerProfileSchema>
export type UpdateTraineeProfileType = z.infer<typeof UpdateTraineeProfileSchema>
export type UpdateProfileBasicInfoType = z.infer<typeof UpdateProfileBasicInfoSchema>
export type UpdateProfileBodyType = z.infer<typeof UpdateProfileBodySchema>
export type UpdateMeBodyType = z.infer<typeof UpdateMeBodySchema>
export type ChangePasswordBodyType = z.infer<typeof ChangePasswordBodySchema>
export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBodySchema>
export type UpdateSignatureBodyType = z.infer<typeof UpdateSignatureBodySchema>
