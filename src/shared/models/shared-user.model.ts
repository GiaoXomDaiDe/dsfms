import z from 'zod'
import { RoleSchema } from '~/routes/role/role.model'
import { GenderStatus, UserStatus } from '~/shared/constants/auth.constant'
import { DepartmentSchema } from '~/shared/models/shared-department.model'

export const UserSchema = z.object({
  id: z.uuid(),
  eid: z.string().max(8),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  middleName: z.string().max(100).nullable(),
  address: z.string().max(255).nullable(),
  email: z.email(),
  passwordHash: z.string().min(6).max(100),
  status: z.enum([UserStatus.ACTIVE, UserStatus.DISABLED]),
  signatureImageUrl: z.string().nullable(),
  roleId: z.uuid(),
  gender: z.enum([GenderStatus.MALE, GenderStatus.FEMALE]),
  phoneNumber: z.string().min(9).max(15).nullable(),
  avatarUrl: z.string().nullable(),
  departmentId: z.uuid().nullable().optional(),
  createdById: z.uuid().nullable(),
  updatedById: z.uuid().nullable(),
  deletedById: z.uuid().nullable(),
  deletedAt: z.iso
    .datetime()
    .transform((d) => new Date(d))
    .nullable(),
  createdAt: z.iso.datetime().transform((d) => new Date(d)),
  updatedAt: z.iso.datetime().transform((d) => new Date(d))
})

export const UserListItemSchema = UserSchema.omit({
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

export const UserLookupResSchema = z.object({
  foundUsers: z.array(UserListItemSchema),
  notFoundIdentifiers: z.array(
    UserSchema.pick({
      eid: true,
      email: true
    })
  )
})

export type GetUsersResType = z.infer<typeof GetUsersResSchema>
export type UserType = z.infer<typeof UserSchema>
export type UserLookupResType = z.infer<typeof UserLookupResSchema>
