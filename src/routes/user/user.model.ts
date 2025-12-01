import z from 'zod'
import {
  CreateTraineeProfileSchema,
  CreateTraineeProfileType,
  CreateTrainerProfileSchema,
  CreateTrainerProfileType,
  TraineeProfileSchema,
  TrainerProfileSchema
} from '~/routes/profile/profile.model'
import {
  AtLeastOneUserRequiredMessage,
  DuplicateEmailInBatchMessage,
  MaximumUsersAllowedMessage
} from '~/routes/user/user.error'
import { validateRoleProfile } from '~/shared/helper'
import { TeachingCourseSchema } from '~/shared/models/shared-course.model'
import { departmentSummarySchema } from '~/shared/models/shared-department.model'
import { roleIdNameSchema, roleSummarySchema } from '~/shared/models/shared-role.model'
import { TeachingSubjectSchema } from '~/shared/models/shared-subject.model'
import { UserListItemSchema, UserSchema } from '~/shared/models/shared-user.model'

/* --------BASE--------- */
const BaseUserWithRoleDeptSchema = UserSchema.omit({
  passwordHash: true,
  roleId: true,
  departmentId: true
}).extend({
  role: roleSummarySchema,
  department: departmentSummarySchema.nullable(),
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

/* --------LIST--------- */
export const GetUsersResSchema = z.object({
  users: z.array(UserListItemSchema),
  totalItems: z.number()
})

/* --------DETAIL--------- */
export const GetUserParamsSchema = z
  .object({
    userId: z.uuid()
  })
  .strict()

export const GetUserResSchema = BaseUserWithRoleDeptSchema.extend({
  teachingCourses: z.array(TeachingCourseSchema).optional(),
  teachingSubjects: z.array(TeachingSubjectSchema).optional()
})

/* --------CREATE--------- */
export const CreateUserBodySchema = UserSchema.pick({
  firstName: true,
  lastName: true,
  middleName: true,
  address: true,
  email: true,
  gender: true,
  phoneNumber: true,
  avatarUrl: true
})
  .extend({
    role: roleIdNameSchema,
    trainerProfile: CreateTrainerProfileSchema.optional(),
    traineeProfile: CreateTraineeProfileSchema.optional()
  })
  .strict()
  .superRefine(superRefineCreateUserProfile)

export const UserWithProfileRelationSchema = UserSchema.extend({
  role: roleSummarySchema,
  department: departmentSummarySchema.nullable(),
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

/* --------CREATE_BULK--------- */
export const CreateBulkUsersBodySchema = z
  .object({
    users: z.array(CreateUserBodySchema).min(1, AtLeastOneUserRequiredMessage).max(100, MaximumUsersAllowedMessage)
  })
  .strict()
  .superRefine(superRefineBulkEmails)

export const BulkCreateResSchema = z.object({
  success: z.array(BaseUserWithRoleDeptSchema),
  failed: z.array(
    z.object({
      index: z.number(),
      error: z.string(),
      userData: CreateUserBodySchema
    })
  ),
  summary: z.object({
    total: z.number(),
    successful: z.number(),
    failed: z.number()
  })
})

/* --------UPDATE--------- */
export const UpdateUserResSchema = GetUserResSchema

export const UpdateUserBodySchema = CreateUserBodySchema.partial().superRefine(superRefineUpdateRoleProfile)

export type GetUsersResType = z.infer<typeof GetUsersResSchema>
export type GetUserResType = z.infer<typeof GetUserResSchema>
export type GetUserParamsType = z.infer<typeof GetUserParamsSchema>
export type CreateUserBodyType = z.infer<typeof CreateUserBodySchema>
export type UserWithProfileRelationType = z.infer<typeof UserWithProfileRelationSchema>

export type UpdateUserBodyType = z.infer<typeof UpdateUserBodySchema>
export type UpdateUserInternalType = Omit<UpdateUserBodyType, 'role' | 'trainerProfile' | 'traineeProfile'> & {
  passwordHash?: string
  eid?: string
}
export type UpdateUserBodyWithProfileType = z.infer<typeof UpdateUserBodySchema>
export type CreateBulkUsersBodyType = z.infer<typeof CreateBulkUsersBodySchema>
export type BulkCreateResType = z.infer<typeof BulkCreateResSchema>
export type UserProfileWithoutTeachingType = Omit<GetUserResType, 'teachingCourses' | 'teachingSubjects'>

export type UpdateUserResType = z.infer<typeof UpdateUserResSchema>
export type BulkUserData = CreateUserOnlyType & {
  roleName: string
  trainerProfile?: CreateTrainerProfileType
  traineeProfile?: CreateTraineeProfileType
}

// ----- Internal types (service/repo) -----
export type CreateUserBaseType = Omit<CreateUserBodyType, 'role' | 'trainerProfile' | 'traineeProfile'>

export type CreateUserOnlyType = CreateUserBaseType & {
  roleId: string
  passwordHash: string
  eid: string
}

function superRefineCreateUserProfile(data: z.infer<typeof CreateUserBodySchema>, ctx: z.RefinementCtx) {
  validateRoleProfile(data.role.name, data, ctx)
}

function superRefineUpdateRoleProfile(data: z.infer<typeof UpdateUserBodySchema>, ctx: z.RefinementCtx) {
  if (!data.role) return
  validateRoleProfile(data.role.name, data as any, ctx)
}

function superRefineBulkEmails(data: z.infer<typeof CreateBulkUsersBodySchema>, ctx: z.RefinementCtx) {
  // Map email -> list index trong mảng users
  const emailIndexMap = new Map<string, number[]>()

  data.users.forEach((user, index) => {
    const key = user.email.toLowerCase().trim() //case-insensitive
    const indices = emailIndexMap.get(key)
    if (indices) {
      indices.push(index)
    } else {
      emailIndexMap.set(key, [index])
    }
  })

  // Với mỗi email xuất hiện > 1 lần, add issue cho từng index bị trùng
  for (const [email, indices] of emailIndexMap.entries()) {
    if (indices.length <= 1) continue

    indices.forEach((index, i) => {
      const firstIndex = indices[0]
      const duplicateIndex = i === 0 ? indices[1] : firstIndex

      ctx.addIssue({
        code: 'custom',
        message: DuplicateEmailInBatchMessage(email, index, duplicateIndex),
        path: ['users', index, 'email']
      })
    })
  }
}
