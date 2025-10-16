import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import {
  CreateTraineeProfileSchema,
  CreateTrainerProfileSchema,
  TraineeProfileSchema,
  TrainerProfileSchema,
  UpdateTraineeProfileSchema,
  UpdateTrainerProfileSchema
} from '~/routes/profile/profile.model'
import { RoleSchema } from '~/routes/role/role.model'
import {
  AtLeastOneUserRequiredMessage,
  DepartmentAssignmentNotAllowedMessage,
  DepartmentNotAllowedForRoleMessage,
  DepartmentRequiredForDepartmentHeadMessage,
  DepartmentRequiredForTrainerMessage,
  DuplicateEmailInBatchMessage,
  InvalidRoleIdMessage,
  InvalidRoleNameMessage,
  InvalidRoleNameUpdateMessage,
  MaximumUsersAllowedMessage,
  ProfileNotAllowedForRoleMessage
} from '~/routes/user/user.error'
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import { validateRoleProfile } from '~/shared/helper'
import { IncludeDeletedQuerySchema } from '~/shared/models/query.model'
import { DepartmentSchema } from '~/shared/models/shared-department.model'
import { UserSchema } from '~/shared/models/shared-user.model'

export const GetUsersQuerySchema = IncludeDeletedQuerySchema.extend({
  roleName: z.string().optional()
}).strict()

export { PaginatedUserListSchema as GetUsersResSchema } from '~/shared/models/shared-user-list.model'
export type { PaginatedUserListType as GetUsersResType } from '~/shared/models/shared-user-list.model'

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
        message: InvalidRoleNameMessage,
        path: ['roleId']
      })
      return
    }

    if (!data.role.id) {
      ctx.addIssue({
        code: 'custom',
        message: InvalidRoleIdMessage,
        path: ['roleId']
      })
      return
    }

    if (data.role.name === 'DEPARTMENT_HEAD') {
      if (!data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: DepartmentRequiredForDepartmentHeadMessage,
          path: ['departmentId']
        })
      }
    } else if (data.role.name === 'TRAINER') {
      if (!data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: DepartmentRequiredForTrainerMessage,
          path: ['departmentId']
        })
      }
    } else {
      if (data.departmentId) {
        ctx.addIssue({
          code: 'custom',
          message: DepartmentNotAllowedForRoleMessage(data.role.name),
          path: ['departmentId']
        })
      }
    }

    validateRoleProfile(data.role.name, data, ctx)
  })

// Schema cho Response của API GET('profile') và GET('users/:userId')
export const GetUserResSchema = UserSchema.omit({
  passwordHash: true,
  signatureImageUrl: true,
  roleId: true,
  departmentId: true
}).extend({
  role: RoleSchema.pick({
    id: true,
    name: true,
    description: true,
    isActive: true
  }),
  department: DepartmentSchema.pick({
    id: true,
    name: true,
    isActive: true
  }).nullable(),
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

/**
 * Schema cho Response của API PUT('profile') và PUT('users/:userId')
 */
export const UpdateUserResSchema = UserSchema.omit({
  passwordHash: true,
  signatureImageUrl: true,
  roleId: true,
  departmentId: true
}).extend({
  role: RoleSchema.pick({
    id: true,
    name: true,
    isActive: true
  }),
  department: DepartmentSchema.pick({
    id: true,
    name: true,
    isActive: true
  }).nullable(),
  trainerProfile: TrainerProfileSchema.nullable().optional(),
  traineeProfile: TraineeProfileSchema.nullable().optional()
})

export const UpdateUserBodySchema = CreateUserBodySchema.partial()

export const UpdateUserBodyWithProfileSchema = UpdateUserBodySchema.omit({
  roleId: true
})
  .extend({
    trainerProfile: UpdateTrainerProfileSchema.optional(),
    traineeProfile: UpdateTraineeProfileSchema.optional(),
    role: RoleSchema.pick({
      id: true,
      name: true
    }).optional()
  })

  .strict()
  .superRefine((data, ctx) => {
    // Chỉ validate role khi có role data
    if (data.role) {
      if (!data.role.id) {
        ctx.addIssue({
          code: 'custom',
          message: InvalidRoleIdMessage,
          path: ['role', 'id']
        })
        return
      }

      if (!data.role.name) {
        ctx.addIssue({
          code: 'custom',
          message: InvalidRoleNameUpdateMessage,
          path: ['role', 'name']
        })
        return
      }

      // Validate department assignment chỉ khi có role và departmentId được cung cấp
      if (data.departmentId !== undefined) {
        if (data.role.name === 'DEPARTMENT_HEAD' || data.role.name === 'TRAINER') {
          // Các role này được phép có departmentId (có thể null để remove)
        } else {
          // Các role khác không được có departmentId (phải null hoặc undefined)
          if (data.departmentId !== null) {
            ctx.addIssue({
              code: 'custom',
              message: DepartmentAssignmentNotAllowedMessage(data.role.name),
              path: ['departmentId']
            })
          }
        }
      }

      const rules = ROLE_PROFILE_RULES[data.role.name as keyof typeof ROLE_PROFILE_RULES]

      if (rules) {
        // Kiểm tra forbidden profile - chỉ khi profile được cung cấp
        const forbiddenKey = rules.forbiddenProfile as keyof typeof data
        if (forbiddenKey in data && data[forbiddenKey] !== undefined && data[forbiddenKey] !== null) {
          ctx.addIssue({
            code: 'custom',
            message: rules.forbiddenMessage,
            path: [rules.forbiddenProfile]
          })
        }
      } else if (data.role.name !== 'TRAINER' && data.role.name !== 'TRAINEE') {
        // Các role khác (ADMIN, DEPARTMENT_HEAD) không được có bất kỳ profile nào
        const profileKeys: Array<'trainerProfile' | 'traineeProfile'> = ['trainerProfile', 'traineeProfile']
        profileKeys.forEach((profile) => {
          if (profile in data && data[profile] !== undefined && data[profile] !== null) {
            ctx.addIssue({
              code: 'custom',
              message: ProfileNotAllowedForRoleMessage(profile, data.role!.name),
              path: [profile]
            })
          }
        })
      }
    }
  })

export const CreateBulkUsersBodySchema = z
  .object({
    users: z
      .array(CreateUserBodyWithProfileSchema)
      .min(1, AtLeastOneUserRequiredMessage)
      .max(100, MaximumUsersAllowedMessage)
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
          message: DuplicateEmailInBatchMessage(user.email, index, duplicateEmailIndex),
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

// Bulk Trainee Lookup Schemas
export const BulkTraineeLookupItemSchema = z.object({
  eid: z.string().min(1, 'EID is required'),
  fullName: z.string().min(1, 'Full name is required')
})

export const BulkTraineeLookupBodySchema = z.object({
  trainees: z
    .array(BulkTraineeLookupItemSchema)
    .min(1, 'At least one trainee is required')
    .max(100, 'Maximum 100 trainees allowed per request')
})

export const TraineeLookupResultSchema = z.object({
  eid: z.string(),
  fullName: z.string(),
  found: z.boolean(),
  user: UserSchema.omit({
    passwordHash: true,
    signatureImageUrl: true,
    roleId: true,
    departmentId: true
  })
    .extend({
      role: RoleSchema.pick({
        id: true,
        name: true
      }),
      department: DepartmentSchema.pick({
        id: true,
        name: true
      }).nullable(),
      traineeProfile: TraineeProfileSchema.nullable().optional()
    })
    .nullable()
})

export const BulkTraineeLookupResSchema = z.object({
  results: z.array(TraineeLookupResultSchema),
  summary: z.object({
    total: z.number(),
    found: z.number(),
    notFound: z.number()
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
export type BulkTraineeLookupItemType = z.infer<typeof BulkTraineeLookupItemSchema>
export type BulkTraineeLookupBodyType = z.infer<typeof BulkTraineeLookupBodySchema>
export type TraineeLookupResultType = z.infer<typeof TraineeLookupResultSchema>
export type BulkTraineeLookupResType = z.infer<typeof BulkTraineeLookupResSchema>
export type UserType = z.infer<typeof UserSchema>
export type GetUserProfileResType = z.infer<typeof GetUserResSchema>
export type UpdateUserResType = z.infer<typeof UpdateUserResSchema>

// DTO exports
export class BulkTraineeLookupBodyDto extends createZodDto(BulkTraineeLookupBodySchema) {}
export class BulkTraineeLookupResDto extends createZodDto(BulkTraineeLookupResSchema) {}
