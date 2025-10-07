import z from 'zod'
import { GenderStatus, UserStatus } from '~/shared/constants/auth.constant'

export const UserSchema = z.object({
  id: z.uuid(),
  eid: z.string().max(8),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  middleName: z.string().max(100).nullable(),
  address: z.string().max(255).nullable(),
  email: z.email(),
  passwordHash: z.string().min(6).max(100),
  status: z.enum([UserStatus.ACTIVE, UserStatus.DISABLED, UserStatus.SUSPENDED]),
  signatureImageUrl: z.string().nullable(),
  roleId: z.uuid(),
  gender: z.enum([GenderStatus.MALE, GenderStatus.FEMALE]),
  phoneNumber: z.string().min(9).max(15).nullable(),
  avatarUrl: z.string().nullable(),
  departmentId: z.uuid().nullable().optional(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})
