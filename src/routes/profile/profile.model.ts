import z from 'zod'
import { TraineeProfileSchema, TrainerProfileSchema } from '~/shared/models/shared-profile.model'
import { UserSchema } from '~/shared/models/shared-user.model'

/* =========================
 * Profile basic info / self update
 * =======================*/

export const UpdateProfileBasicInfoSchema = UserSchema.pick({
  avatarUrl: true
})

export const UpdateProfileBodySchema = z
  .object({
    avatarUrl: UserSchema.shape.avatarUrl.optional()
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

/* =========================
 * Password change / reset
 * =======================*/

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

/* =========================
 * Signature
 * =======================*/

export const UpdateSignatureBodySchema = z
  .object({
    signatureImageUrl: z.string().url('Signature image URL must be a valid URL')
  })
  .strict()

/* =========================
 * Types
 * =======================*/

export type UpdateProfileBasicInfoType = z.infer<typeof UpdateProfileBasicInfoSchema>
export type UpdateProfileBodyType = z.infer<typeof UpdateProfileBodySchema>
export type UpdateMeBodyType = z.infer<typeof UpdateMeBodySchema>

export type ChangePasswordBodyType = z.infer<typeof ChangePasswordBodySchema>
export type ResetPasswordBodyType = z.infer<typeof ResetPasswordBodySchema>

export type UpdateSignatureBodyType = z.infer<typeof UpdateSignatureBodySchema>
