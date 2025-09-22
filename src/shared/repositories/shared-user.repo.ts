import { Injectable } from '@nestjs/common'
import { UserType } from '~/routes/user/user.model'

import { PrismaService } from '~/shared/services/prisma.service'

type UserIncludeProfileType = UserType & {
  role: {
    id: string
    name: string
  }
  department: {
    id: string
    name: string
  } | null
} & Partial<{
    trainerProfile: object | null
    traineeProfile: object | null
  }>

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

  async findUniqueIncludeProfile(where: WhereUniqueUserType): Promise<UserIncludeProfileType | null> {
    const user = await this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: null
      },
      include: {
        role: {
          select: {
            id: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        trainerProfile: true,
        traineeProfile: true
      }
    })
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
