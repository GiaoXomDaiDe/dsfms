import { Injectable } from '@nestjs/common'
import { PermissionType } from '~/routes/permission/permission.model'
import { RoleType } from '~/routes/role/role.model'
import { UserType } from '~/routes/user/user.model'

import { PrismaService } from '~/shared/services/prisma.service'

type UserIncludeRolePermissionsType = UserType & { role: (RoleType & { permissions: PermissionType[] }) | null } & {
  department: { id: string; name: string } | null
}

export type WhereUniqueUserType = { id: string } | { email: string }
@Injectable()
export class SharedUserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findUnique(where: WhereUniqueUserType): Promise<UserType | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: null
      }
    })
  }

  async findUniqueIncludeRolePermissions(where: WhereUniqueUserType): Promise<UserIncludeRolePermissionsType | null> {
    const user = await this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: null
      },
      include: {
        role: {
          include: {
            permissions: {
              where: {
                deletedAt: null
              }
            }
          }
        },
        department: {
          select: { id: true, name: true }
        }
      }
    })
    if (user && user.role.deletedAt !== null) {
      ;(user as UserIncludeRolePermissionsType).role = null
    }
    return user
  }

  update(where: { id: string }, data: Partial<UserType>): Promise<UserType | null> {
    return this.prismaService.user.update({
      where: {
        ...where,
        deletedAt: null
      },
      data
    })
  }
}
