import { z } from 'zod'
import { DepartmentSchema } from '~/routes/department/department.model'
import { RoleSchema } from '~/routes/role/role.model'
import { UserSchema } from '~/shared/models/shared-user.model'

// Shared user info schema for list responses (used by both user list and lookup APIs)
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

// Paginated user list response schema
export const PaginatedUserListSchema = z.object({
  data: z.array(UserListItemSchema),
  totalItems: z.number()
})

// User lookup response schema (similar to paginated but with different structure)
export const UserLookupResSchema = z.object({
  foundUsers: z.array(UserListItemSchema),
  notFoundIdentifiers: z.array(
    z.object({
      eid: z.string().optional(),
      email: z.string().optional()
    })
  )
})

// Type exports
export type UserListItemType = z.infer<typeof UserListItemSchema>
export type PaginatedUserListType = z.infer<typeof PaginatedUserListSchema>
export type UserLookupResType = z.infer<typeof UserLookupResSchema>
