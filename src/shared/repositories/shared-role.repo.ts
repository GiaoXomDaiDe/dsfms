import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RoleType } from '~/routes/role/role.model'
import { RoleName } from '~/shared/constants/auth.constant'

@Injectable()
export class SharedRoleRepository {
  private traineeRoleId: string | null = null
  private adminRoleId: string | null = null

  constructor(private readonly prismaService: PrismaService) {}

  private async getRole(roleName: string) {
    const role: RoleType = await this.prismaService.$queryRaw`
    SELECT * FROM "Role" WHERE name = ${roleName} AND "deletedAt" IS NULL LIMIT 1;
  `.then((res: RoleType[]) => {
      if (res.length === 0) {
        throw new Error('Role not found')
      }
      return res[0]
    })
    return role
  }

  async getTraineeRoleId() {
    if (this.traineeRoleId) {
      return this.traineeRoleId
    }
    const role = await this.getRole(RoleName.TRAINEE)

    this.traineeRoleId = role.id
    return role.id
  }

  async getAdminRoleId() {
    if (this.adminRoleId) {
      return this.adminRoleId
    }
    const role = await this.getRole(RoleName.ADMINISTRATOR)

    this.adminRoleId = role.id
    return role.id
  }
}
