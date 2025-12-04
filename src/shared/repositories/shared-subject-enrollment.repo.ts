import { Injectable } from '@nestjs/common'
import {
  SubjectEnrollmentTraineeSnapshotSchema,
  SubjectEnrollmentTraineeSnapshotType
} from '~/routes/subject/subject.model'
import { SubjectEnrollmentStatus } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedSubjectEnrollmentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findTraineesBySubjectIds(
    subjectIds: string[],
    { batchCode }: { batchCode?: string } = {}
  ): Promise<SubjectEnrollmentTraineeSnapshotType[]> {
    if (subjectIds.length === 0) {
      return []
    }

    const enrollments = await this.prismaService.subjectEnrollment.findMany({
      where: {
        subjectId: { in: subjectIds },
        ...(batchCode ? { batchCode } : {}),
        status: {
          not: SubjectEnrollmentStatus.CANCELLED
        }
      },
      select: {
        subjectId: true,
        traineeUserId: true,
        batchCode: true,
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    return enrollments.map((record) =>
      SubjectEnrollmentTraineeSnapshotSchema.parse({
        subjectId: record.subjectId,
        traineeUserId: record.traineeUserId,
        batchCode: record.batchCode,
        trainee: record.trainee
          ? {
              id: record.trainee.id,
              eid: record.trainee.eid,
              firstName: record.trainee.firstName,
              middleName: record.trainee.middleName,
              lastName: record.trainee.lastName,
              email: record.trainee.email
            }
          : null
      })
    )
  }
}
