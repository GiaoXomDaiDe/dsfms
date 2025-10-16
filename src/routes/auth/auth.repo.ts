import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import * as statusConst from '~/shared/constants/auth.constant'

export interface UserWithRelations {
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  status: string
  deletedAt: Date | null
  role: {
    id: string
    name: string
    description: string | null
  }
  department: {
    id: string
    name: string
  } | null
}

@Injectable()
export class AuthRepo {
  constructor(private prismaService: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserWithRelations | null> {
    return this.prismaService.user.findFirst({
      where: {
        email: email,
        deletedAt: null
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findActiveUserByEmail(email: string): Promise<UserWithRelations | null> {
    return this.prismaService.user.findFirst({
      where: {
        email: email,
        deletedAt: null,
        status: statusConst.UserStatus.ACTIVE
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findUserById(id: string): Promise<UserWithRelations | null> {
    return this.prismaService.user.findFirst({
      where: {
        id: id,
        deletedAt: null,
        status: statusConst.UserStatus.ACTIVE
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date()
      }
    })
  }
}
