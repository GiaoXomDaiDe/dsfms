import z from 'zod'
import {
  BASIC_TEXT_REGEX,
  CODE_TEXT_REGEX,
  COUNTRY_REGEX,
  PASSPORT_REGEX,
  optionalText,
  requiredText
} from '~/shared/constants/validation.constant'
import { UserSchema } from '~/shared/models/shared-user.model'

export const TrainerProfileSchema = z.object({
  specialization: requiredText('Specialization', 100, {
    pattern: BASIC_TEXT_REGEX,
    message: 'Specialization may only contain letters, numbers, spaces, and common punctuation'
  }),
  certificationNumber: requiredText('Certification number', 50, {
    pattern: CODE_TEXT_REGEX,
    message: 'Certification number may only contain letters, numbers, spaces, dash, slash, or underscore'
  }),
  yearsOfExp: z
    .number()
    .int('Years of experience must be a whole number')
    .min(0, 'Years of experience cannot be negative')
    .max(50, 'Years of experience cannot exceed 50 years')
    .nullable()
    .default(0),
  bio: optionalText('Bio', 1000, {
    pattern: BASIC_TEXT_REGEX,
    message: 'Bio contains unsupported characters'
  }),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .nullable(),
  createdAt: z.iso.datetime().transform((value) => new Date(value)),
  updatedAt: z.iso.datetime().transform((value) => new Date(value))
})

export const TraineeProfileSchema = z
  .object({
    dob: z.iso
      .datetime()
      .transform((value) => new Date(value))
      .superRefine((date, ctx) => {
        if (Number.isNaN(date.getTime())) {
          ctx.addIssue({ code: 'custom', message: 'Date of birth must be a valid date' })
        } else if (date.getTime() > Date.now()) {
          ctx.addIssue({ code: 'custom', message: 'Date of birth cannot be in the future' })
        }
      }),
    enrollmentDate: z.iso
      .datetime()
      .transform((value) => new Date(value))
      .nullable()
      .optional(),
    trainingBatch: requiredText('Training batch', 100, {
      pattern: CODE_TEXT_REGEX,
      message: 'Training batch may only contain letters, numbers, spaces, dash, slash, or underscore'
    }),
    passportNo: requiredText('Passport number', 100, {
      pattern: PASSPORT_REGEX,
      message: 'Passport number may only contain letters, numbers, spaces, or hyphen'
    }),
    nation: optionalText('Nation', 100, {
      pattern: COUNTRY_REGEX,
      message: 'Nation may only contain alphabetic characters and separators'
    }),
    createdById: z.uuid().nullable(),
    updatedById: z.uuid().nullable(),
    deletedById: z.uuid().nullable(),
    deletedAt: z.iso
      .datetime()
      .transform((value) => new Date(value))
      .nullable(),
    createdAt: z.iso.datetime().transform((value) => new Date(value)),
    updatedAt: z.iso.datetime().transform((value) => new Date(value))
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

export const UpdateProfileBasicInfoSchema = UserSchema.pick({
  email: true,
  firstName: true,
  lastName: true,
  middleName: true,
  address: true,
  phoneNumber: true,
  avatarUrl: true,
  gender: true
})

export const UpdateProfileBodySchema = UpdateProfileBasicInfoSchema.extend({
  trainerProfile: UpdateTrainerProfileSchema.optional(),
  traineeProfile: UpdateTraineeProfileSchema.optional()
})

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
