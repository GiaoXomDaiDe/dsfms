import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class EidService {
  private readonly rolePrefixMap: Record<string, string> = {
    [RoleName.ADMINISTRATOR]: 'AD',
    [RoleName.DEPARTMENT_HEAD]: 'DH',
    [RoleName.SQA_AUDITOR]: 'QA',
    [RoleName.TRAINER]: 'TR',
    [RoleName.TRAINEE]: 'TE'
  }
  constructor(private readonly prisma: PrismaService) {}

  async generateEid({ roleName, count }: { roleName: string; count?: number }): Promise<string | string[]> {
    const prefix = this.rolePrefixMap[roleName]
    if (!prefix) {
      throw new Error('Không có EID cho vai trò này')
    }

    return await this.prisma.$transaction(async ({ user }: Prisma.TransactionClient) => {
      const lastUser = await user.findFirst({
        where: { eid: { startsWith: prefix } },
        orderBy: { eid: 'desc' },
        select: { eid: true }
      })

      let nextNumber = 1
      if (lastUser && lastUser.eid) {
        const currentNumber = parseInt(lastUser.eid.substring(2))
        nextNumber = currentNumber + 1
      }
      if (!count) {
        const eid = `${prefix}${nextNumber.toString().padStart(6, '0')}`
        return eid
      }

      const eids: string[] = []
      for (let i = 0; i < count; i++) {
        const eid = `${prefix}${(nextNumber + i).toString().padStart(6, '0')}`
        eids.push(eid)
      }
      return eids
    })
  }
  isEidMatchingRole(eid: string, roleName: string): boolean {
    const expectedPrefix = this.rolePrefixMap[roleName]
    return expectedPrefix ? eid.startsWith(expectedPrefix) : false
  }
}
