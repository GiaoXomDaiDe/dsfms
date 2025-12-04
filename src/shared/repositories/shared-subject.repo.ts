import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { SubjectEnrollmentStatus, SubjectStatus } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SubjectType } from '~/shared/models/shared-subject.model'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedSubjectRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findIds(courseId: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<string[]> {
    const subjectIds = await this.prismaService.subject.findMany({
      where: {
        courseId,
        ...(includeDeleted ? {} : { deletedAt: null, status: { not: SubjectStatus.ARCHIVED } })
      },
      select: { id: true }
    })

    return subjectIds.map((subjectId) => subjectId.id)
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<SubjectType | null> {
    const subject = await this.prismaService.subject.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null })
      }
    })

    if (!subject) {
      return null
    }

    return subject
  }

  async checkCodeExists(code: string, courseId: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.SubjectWhereInput = {
      code,
      courseId,
      deletedAt: null,
      ...(excludeId && {
        id: {
          not: excludeId
        }
      })
    }

    const existing = await this.prismaService.subject.findFirst({
      where,
      select: { id: true }
    })

    return existing !== null
  }

  async existsInstructorOngoingSubject(trainerUserId: string): Promise<boolean> {
    return (
      (await this.prismaService.subjectInstructor.count({
        where: {
          trainerUserId,
          subject: {
            deletedAt: null,
            status: SubjectStatus.ON_GOING
          }
        }
      })) > 0
    )
  }

  async existTraineeOngoingEnrollment(traineeUserId: string): Promise<boolean> {
    return (
      (await this.prismaService.subjectEnrollment.count({
        where: {
          traineeUserId,
          subject: {
            deletedAt: null,
            status: SubjectEnrollmentStatus.ON_GOING
          }
        }
      })) > 0
    )
  }
}
