import { z } from 'zod'
import { DepartmentSchema } from '~/routes/department/department.model'
import { PermissionSchema } from '~/routes/permission/permission.model'
import { RoleSchema } from '~/routes/role/role.model'
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
  departmentId: z.uuid().nullable(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
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
    permissions: z.array(
      PermissionSchema.pick({
        id: true,
        name: true,
        module: true,
        path: true,
        method: true
      })
    )
  }),
  department: DepartmentSchema.pick({
    id: true,
    name: true
  }).nullable()
})

/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId')
 */
export const UpdateProfileResSchema = UserSchema.omit({
  passwordHash: true,
  signatureImageUrl: true
})

export const UpdateUserBodySchema = CreateUserBodySchema

export type UserType = z.infer<typeof UserSchema>
export type GetUsersResType = z.infer<typeof GetUsersResSchema>
export type GetUsersQueryType = z.infer<typeof GetUsersQuerySchema>
export type GetUserParamsType = z.infer<typeof GetUserParamsSchema>
export type CreateUserBodyType = z.infer<typeof CreateUserBodySchema>
export type UpdateUserBodyType = z.infer<typeof UpdateUserBodySchema>
export type CreateUserInternalType = CreateUserBodyType & {
  passwordHash: string
  eid: string
}
