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

/* =========================
 * Base schemas
 * =======================*/

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

export const UserWithProfileRelationSchema = UserSchema.extend({
  role: roleSummarySchema,
  department: departmentSummarySchema.nullable(),
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

/* =========================
 * Response schemas
 * =======================*/

export const GetUsersResSchema = z.object({
  users: z.array(UserListItemSchema),
  totalItems: z.number()
})

export const GetUserParamsSchema = z
  .object({
    userId: z.uuid()
  })
  .strict()

export const GetUserResSchema = BaseUserWithRoleDeptSchema.extend({
  teachingCourses: z.array(TeachingCourseSchema).optional(),
  teachingSubjects: z.array(TeachingSubjectSchema).optional()
})

export const UpdateUserResSchema = GetUserResSchema

/* =========================
 * Request schemas (create/update)
 * =======================*/

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

export const UpdateUserBodySchema = CreateUserBodySchema.partial().superRefine(superRefineUpdateRoleProfile)

/* =========================
 * Request schemas (bulk)
 * =======================*/

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

/* =========================
 * Types
 * =======================*/

export type GetUsersResType = z.infer<typeof GetUsersResSchema>
export type GetUserResType = z.infer<typeof GetUserResSchema>
export type GetUserParamsType = z.infer<typeof GetUserParamsSchema>

export type CreateUserBodyType = z.infer<typeof CreateUserBodySchema>
export type UpdateUserBodyType = z.infer<typeof UpdateUserBodySchema>

export type UserWithProfileRelationType = z.infer<typeof UserWithProfileRelationSchema>
export type UserProfileWithoutTeachingType = Omit<GetUserResType, 'teachingCourses' | 'teachingSubjects'>

export type UpdateUserResType = z.infer<typeof UpdateUserResSchema>

export type CreateBulkUsersBodyType = z.infer<typeof CreateBulkUsersBodySchema>
export type BulkCreateResType = z.infer<typeof BulkCreateResSchema>

export type CreateUserBaseType = Omit<CreateUserBodyType, 'role' | 'trainerProfile' | 'traineeProfile'>

export type CreateUserOnlyType = CreateUserBaseType & {
  roleId: string
  passwordHash: string
  eid: string
}

export type BulkUserData = CreateUserOnlyType & {
  roleName: string
  trainerProfile?: CreateTrainerProfileType
  traineeProfile?: CreateTraineeProfileType
}

export type UpdateUserInternalType = Omit<UpdateUserBodyType, 'role' | 'trainerProfile' | 'traineeProfile'> & {
  passwordHash?: string
  eid?: string
}

/* =========================
 * Super refine helpers
 * =======================*/

function superRefineCreateUserProfile(data: z.infer<typeof CreateUserBodySchema>, ctx: z.RefinementCtx) {
  validateRoleProfile(data.role.name, data, ctx)
}

function superRefineUpdateRoleProfile(data: z.infer<typeof UpdateUserBodySchema>, ctx: z.RefinementCtx) {
  if (!data.role) return
  validateRoleProfile(data.role.name, data as any, ctx)
}

function superRefineBulkEmails(data: z.infer<typeof CreateBulkUsersBodySchema>, ctx: z.RefinementCtx) {
  const emailIndexMap = new Map<string, number[]>()

  data.users.forEach((user, index) => {
    const key = user.email.toLowerCase().trim()
    const indices = emailIndexMap.get(key)
    if (indices) {
      indices.push(index)
    } else {
      emailIndexMap.set(key, [index])
    }
  })

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
