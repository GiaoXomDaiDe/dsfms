import { z } from 'zod'
import { DepartmentSchema } from '~/routes/department/department.model'
import { PermissionSchema } from '~/routes/permission/permission.model'
import {
  CreateTraineeProfileSchema,
  CreateTrainerProfileSchema,
  TraineeProfileSchema,
  TrainerProfileSchema,
  UpdateTraineeProfileSchema,
  UpdateTrainerProfileSchema
} from '~/routes/profile/profile.model'
import { RoleSchema } from '~/routes/role/role.model'
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import { validateRoleProfile } from '~/shared/helper'
import { UserSchema } from '~/shared/models/shared-user.model'

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
  }).extend({
    permissions: z
      .array(
        PermissionSchema.pick({
          id: true,
          name: true,
          description: true,
          isActive: true,
          method: true,
          module: true,
          path: true,
          viewModule: true,
          viewName: true
        })
      )
      .optional()
      .default([])
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
export const UpdateUserResSchema = UserSchema.omit({
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
  totalItems: z.number()
})

export const GetUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10),
    includeDeleted: z.coerce.boolean().default(false).optional()
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

export const UpdateUserBodySchema = CreateUserBodySchema.partial()

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
  trainerProfile: UpdateTrainerProfileSchema.optional(),
  traineeProfile: UpdateTraineeProfileSchema.optional(),
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

export const CreateBulkUsersBodySchema = z
  .object({
    users: z
      .array(CreateUserBodyWithProfileSchema)
      .min(1, 'At least one user is required')
      .max(100, 'Maximum 100 users allowed per batch')
  })
  .strict()
  .superRefine((data, ctx) => {
    data.users.forEach((user, index) => {
      // Kiểm tra các email trùng lặp trong cùng một batch
      const duplicateEmailIndex = data.users.findIndex(
        (otherUser, otherIndex) => otherIndex !== index && otherUser.email === user.email
      )

      if (duplicateEmailIndex !== -1) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate email found: ${user.email} (users at index ${index} and ${duplicateEmailIndex})`,
          path: ['users', index, 'email']
        })
      }
    })
  })

export const BulkCreateResultSchema = z.object({
  success: z.array(
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
      }).nullable(),
      trainerProfile: TrainerProfileSchema.nullable().optional(),
      traineeProfile: TraineeProfileSchema.nullable().optional()
    })
  ),
  failed: z.array(
    z.object({
      index: z.number(),
      error: z.string(),
      userData: CreateUserBodyWithProfileSchema
    })
  ),
  summary: z.object({
    total: z.number(),
    successful: z.number(),
    failed: z.number()
  })
})

export type GetUsersQueryType = z.infer<typeof GetUsersQuerySchema>
export type GetUserParamsType = z.infer<typeof GetUserParamsSchema>
export type CreateUserBodyType = z.infer<typeof CreateUserBodySchema>
export type UpdateUserBodyType = z.infer<typeof UpdateUserBodySchema>
export type CreateUserInternalType = CreateUserBodyType & {
  passwordHash: string
  eid: string
}
export type UpdateUserInternalType = UpdateUserBodyType & {
  passwordHash?: string
  eid?: string
}
export type CreateUserBodyWithProfileType = z.infer<typeof CreateUserBodyWithProfileSchema>
export type UpdateUserBodyWithProfileType = z.infer<typeof UpdateUserBodyWithProfileSchema>
export type CreateBulkUsersBodyType = z.infer<typeof CreateBulkUsersBodySchema>
export type BulkCreateResultType = z.infer<typeof BulkCreateResultSchema>
export type UserType = z.infer<typeof UserSchema>
export type GetUserProfileResType = z.infer<typeof GetUserProfileResSchema>
export type UpdateUserResType = z.infer<typeof UpdateUserResSchema>
export type GetUsersResType = z.infer<typeof GetUsersResSchema>
