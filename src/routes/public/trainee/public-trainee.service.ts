import { Injectable } from '@nestjs/common'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import { GetPublicTraineesResType, PublicTraineeType } from './public-trainee.dto'

@Injectable()
export class PublicTraineeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active trainees for public consumption.
   * Returns safe-to-share fields only.
   */
  async getAllActive(): Promise<GetPublicTraineesResType> {
    const trainees = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: {
          name: RoleName.TRAINEE
        }
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        departmentId: true,
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    })

    const transformed = trainees.map((trainee) => {
      const nameParts = [trainee.firstName, trainee.middleName, trainee.lastName].filter(Boolean)

      return {
        id: trainee.id,
        eid: trainee.eid,
        fullName: nameParts.join(' '),
        email: trainee.email,
        departmentId: trainee.departmentId,
        departmentName: trainee.department?.name ?? null,
        avatarUrl: trainee.avatarUrl ?? null
      }
    }) as PublicTraineeType[]

    return {
      data: transformed,
      totalItems: transformed.length
    }
  }
}
