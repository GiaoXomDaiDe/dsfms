import { z } from 'zod'
import { DepartmentSchema } from '~/routes/department/department.model'
import {
  CreateTraineeProfileSchema,
  CreateTrainerProfileSchema,
  TraineeProfileSchema,
  TrainerProfileSchema,
  UpdateTraineeProfileSchema,
  UpdateTrainerProfileSchema
} from '~/routes/profile/profile.model'
import { RoleSchema } from '~/routes/role/role.model'
import { GenderStatus, UserStatus } from '~/shared/constants/auth.constant'
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import { validateRoleProfile } from '~/shared/helper'

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
  departmentId: z.uuid().nullable(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

//Áp dụng cho Response của api GET('profile') và GET('users/:userId)
export const GetUserProfileResSchema = UserSchema.omit({
  passwordHash: true,
  signatureImageUrl: true,
  roleId: true,
  departmentId: true
}).extend({
  role: RoleSchema.pick({
    id: true,
    name: true
  }),
  department: DepartmentSchema.pick({
    id: true,
    name: true
  }).nullable(),
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId')
 */
export const UpdateProfileResSchema = UserSchema.omit({
  passwordHash: true,
  signatureImageUrl: true
})

export const GetUsersResSchema = z.object({
  data: z.array(
    UserSchema.omit({
      passwordHash: true,
      signatureImageUrl: true,
      roleId: true,
      departmentId: true
    }).extend({
      role: RoleSchema.pick({
        id: true,
        name: true
      }),
      department: DepartmentSchema.pick({
        id: true,
        name: true
      }).nullable()
    })
  ),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number()
})

export const GetUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10)
  })
  .strict()

export const GetUserParamsSchema = z
  .object({
    userId: z.uuid()
  })
  .strict()

export const CreateUserBodySchema = UserSchema.pick({
  firstName: true,
  lastName: true,
  middleName: true,
  address: true,
  email: true,
  roleId: true,
  gender: true,
  phoneNumber: true,
  avatarUrl: true
})
  .extend({
    departmentId: z.uuid().nullable().optional()
  })
  .strict()

export const UpdateUserBodySchema = CreateUserBodySchema

export const CreateUserBodyWithProfileSchema = CreateUserBodySchema.extend({
  trainerProfile: CreateTrainerProfileSchema.optional(),
  traineeProfile: CreateTraineeProfileSchema.optional(),
  role: RoleSchema.pick({
    id: true,
    name: true
  })
})
  .omit({
    roleId: true
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.role.id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid Role Name',
        path: ['roleId']
      })
      return
    }

    if (!data.role.id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid role ID',
        path: ['roleId']
      })
      return
    }

    validateRoleProfile(data.role.name, data, ctx)
  })
export const UpdateUserBodyWithProfileSchema = UpdateUserBodySchema.extend({
  trainerProfile: UpdateTrainerProfileSchema.partial().optional(),
  traineeProfile: UpdateTraineeProfileSchema.partial().optional(),
  role: RoleSchema.pick({
    id: true,
    name: true
  })
})
  .omit({
    roleId: true
  })
  .strict()
  .superRefine((data, ctx) => {
    // Only validate if roleId is being updated
    if (!data.role) return

    if (!data.role.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid role Name',
        path: ['roleId']
      })
      return
    }

    // For updates, only check forbidden profiles (not required)
    const rules = ROLE_PROFILE_RULES[data.role.name as keyof typeof ROLE_PROFILE_RULES]

    if (rules) {
      // Fix: Type-safe access with proper key checking
      const forbiddenKey = rules.forbiddenProfile as keyof typeof data
      if (forbiddenKey in data && data[forbiddenKey]) {
        ctx.addIssue({
          code: 'custom',
          message: rules.forbiddenMessage,
          path: [rules.forbiddenProfile]
        })
      }
    } else {
      // Other roles shouldn't have any profile
      const profileKeys: Array<'trainerProfile' | 'traineeProfile'> = ['trainerProfile', 'traineeProfile']
      profileKeys.forEach((profile) => {
        if (profile in data && data[profile]) {
          ctx.addIssue({
            code: 'custom',
            message: `${profile} is not allowed for ${data.role.name} role`,
            path: [profile]
          })
        }
      })
    }
  })

export type GetUsersQueryType = z.infer<typeof GetUsersQuerySchema>
export type GetUserParamsType = z.infer<typeof GetUserParamsSchema>
export type CreateUserBodyType = z.infer<typeof CreateUserBodySchema>
export type UpdateUserBodyType = z.infer<typeof UpdateUserBodySchema>
export type CreateUserInternalType = CreateUserBodyType & {
  passwordHash: string
  eid: string
}
export type CreateUserBodyWithProfileType = z.infer<typeof CreateUserBodyWithProfileSchema>
export type UserType = z.infer<typeof UserSchema>
export type GetUserProfileResType = z.infer<typeof GetUserProfileResSchema>
export type UpdateProfileResType = z.infer<typeof UpdateProfileResSchema>
export type GetUsersResType = z.infer<typeof GetUsersResSchema>
