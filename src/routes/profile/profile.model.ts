import z from 'zod'
import { UserSchema } from '~/shared/models/shared-user.model'

export const TrainerProfileSchema = z.object({
  specialization: z.string().max(100),
  certificationNumber: z.string().max(50),
  yearsOfExp: z.number().min(0).max(50).nullable().default(0),
  bio: z.string().max(1000).nullable(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d))
})

export const TraineeProfileSchema = z.object({
  dob: z.iso.datetime().transform((value) => new Date(value)),
  enrollmentDate: z.iso
    .datetime()
    .transform((value) => new Date(value))
    .nullable(),
  trainingBatch: z.string().max(100),
  passportNo: z.string().max(100),
  nation: z.string().max(100).nullable(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d))
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

// Schema for updating basic user info (no role change)
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

// Schema for updating profile (basic info + role-specific profile)
export const UpdateProfileBodySchema = UpdateProfileBasicInfoSchema.extend({
  trainerProfile: UpdateTrainerProfileSchema.optional(),
  traineeProfile: UpdateTraineeProfileSchema.optional()
})

export type TrainerProfileType = z.infer<typeof TrainerProfileSchema>
export type TraineeProfileType = z.infer<typeof TraineeProfileSchema>
export type CreateTraineeProfileType = z.infer<typeof CreateTraineeProfileSchema>
export type CreateTrainerProfileType = z.infer<typeof CreateTrainerProfileSchema>
export type UpdateTrainerProfileType = z.infer<typeof UpdateTrainerProfileSchema>
export type UpdateTraineeProfileType = z.infer<typeof UpdateTraineeProfileSchema>
export type UpdateProfileBasicInfoType = z.infer<typeof UpdateProfileBasicInfoSchema>
export type UpdateProfileBodyType = z.infer<typeof UpdateProfileBodySchema>

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

// Schema để reset mật khẩu - yêu cầu mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới
// Validation: confirmNewPassword phải khớp với newPassword
export const ResetPasswordBodySchema = z
  .object({
    oldPassword: z.string().min(6).max(100), // Mật khẩu cũ để xác thực
    newPassword: z.string().min(6).max(100), // Mật khẩu mới
    confirmNewPassword: z.string().min(6).max(100) // Xác nhận mật khẩu mới
  })
  .strict()
  .superRefine(({ confirmNewPassword, newPassword }, ctx) => {
    // Check whether confirmNewPassword matches newPassword
    if (newPassword !== confirmNewPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'New password and confirmation do not match',
        path: ['confirmNewPassword']
      })
    }
  })

export type UpdateMeBodyType = z.infer<typeof UpdateMeBodySchema>
export type ChangePasswordBodyType = z.infer<typeof ChangePasswordBodySchema>
export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBodySchema>
