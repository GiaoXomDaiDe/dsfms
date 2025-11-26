import z from 'zod'
import { isoDatetimeSchema, nullableUuidSchema, urlSchema } from '~/shared/helpers/zod-validation.helper'
import { departmentSummarySchema } from '~/shared/models/shared-department.model'
import { roleSummarySchema } from '~/shared/models/shared-role.model'
import {
  userAddressSchema,
  userGenderSchema,
  userMiddleNameSchema,
  userNameSchema,
  userPhoneNumberSchema,
  userStatusSchema
} from '~/shared/validation/user.validation'

export const UserSchema = z.object({
  id: z.uuid(),
  eid: z.string().max(8),
  firstName: userNameSchema,
  lastName: userNameSchema,
  middleName: userMiddleNameSchema,
  address: userAddressSchema,
  email: z.email().min(5).max(255),
  passwordHash: z.string().min(2).max(100),
  status: userStatusSchema,
  signatureImageUrl: urlSchema,
  roleId: z.uuid(),
  gender: userGenderSchema,
  phoneNumber: userPhoneNumberSchema,
  avatarUrl: urlSchema,
  departmentId: nullableUuidSchema,
  createdById: nullableUuidSchema,
  updatedById: nullableUuidSchema,
  deletedById: nullableUuidSchema,
  deletedAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema
})

export const UserListItemSchema = UserSchema.omit({
  passwordHash: true,
  roleId: true,
  departmentId: true
}).extend({
  role: roleSummarySchema,
  department: departmentSummarySchema.nullable()
})

export const UserLookupResSchema = z.object({
  foundUsers: z.array(UserListItemSchema),
  notFoundIdentifiers: z.array(
    UserSchema.pick({
      eid: true,
      email: true
    })
  )
})

export type UserType = z.infer<typeof UserSchema>
export type UserLookupResType = z.infer<typeof UserLookupResSchema>
export type UserListItemType = z.infer<typeof UserListItemSchema>
