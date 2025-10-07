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
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import { validateRoleProfile } from '~/shared/helper'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'
import { UserSchema } from '~/shared/models/shared-user.model'

export const GetUsersQuerySchema = IncludeDeletedQuerySchema.strict()

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
  avatarUrl: true,
  departmentId: true
})
  .extend({
    role: RoleSchema.pick({
      id: true,
      name: true
    })
  })
  .strict()

export const CreateUserBodyWithProfileSchema = CreateUserBodySchema.extend({
  trainerProfile: CreateTrainerProfileSchema.optional(),
  traineeProfile: CreateTraineeProfileSchema.optional()
})
  .omit({
    roleId: true
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.role.name) {
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

    if (data.role.name === 'DEPARTMENT_HEAD') {
      if (!data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: 'Department ID is required for DEPARTMENT_HEAD role',
          path: ['departmentId']
        })
      }
    } else if (data.role.name === 'TRAINER') {
      if (!data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: 'Department ID is required for TRAINER role',
          path: ['departmentId']
        })
      }
    } else {
      if (data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: `Department ID is not allowed for ${data.role.name} role. Only TRAINER and DEPARTMENT_HEAD roles can be assigned to a department.`,
          path: ['departmentId']
        })
      }
    }

    validateRoleProfile(data.role.name, data, ctx)
  })

//Áp dụng cho Response của api GET('profile') và GET('users/:userId)
export const GetUserResSchema = UserSchema.omit({
  passwordHash: true,
  signatureImageUrl: true,
  roleId: true,
  departmentId: true
}).extend({
  role: RoleSchema.pick({
    id: true,
    name: true,
    description: true
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

export const UpdateUserBodySchema = CreateUserBodySchema.partial()

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
    if (!data.role?.id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid role ID',
        path: ['roleId']
      })
      return
    }

    if (!data.role?.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid role name',
        path: ['role', 'name']
      })
      return
    }

    // Validate department requirements based on role (for updates)
    if (data.role.name === 'DEPARTMENT_HEAD' || data.role.name === 'TRAINER') {
      // For these roles, if departmentId is provided it should be valid
      // If not provided, it means no change to department assignment
    } else {
      // Other roles should not have departmentId
      if (data.departmentId !== undefined && data.departmentId !== null) {
        ctx.addIssue({
          code: 'custom',
          message: `Department assignment is not allowed for ${data.role.name} role. Only TRAINER and DEPARTMENT_HEAD roles can be assigned to a department.`,
          path: ['departmentId']
        })
      }
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
    // Additional validation for bulk operations
    data.users.forEach((user, index) => {
      // Check for duplicate emails within the batch
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
export type CreateUserInternalType = Omit<CreateUserBodyType, 'role'> & {
  passwordHash: string
  eid: string
}
export type UpdateUserBodyType = z.infer<typeof UpdateUserBodySchema>
export type UpdateUserInternalType = Omit<UpdateUserBodyType, 'role'> & {
  passwordHash?: string
  eid?: string
}
export type CreateUserBodyWithProfileType = z.infer<typeof CreateUserBodyWithProfileSchema>
export type UpdateUserBodyWithProfileType = z.infer<typeof UpdateUserBodyWithProfileSchema>
export type CreateBulkUsersBodyType = z.infer<typeof CreateBulkUsersBodySchema>
export type BulkCreateResultType = z.infer<typeof BulkCreateResultSchema>
export type UserType = z.infer<typeof UserSchema>
export type GetUserProfileResType = z.infer<typeof GetUserResSchema>
export type UpdateUserResType = z.infer<typeof UpdateUserResSchema>
export type GetUsersResType = z.infer<typeof GetUsersResSchema>
