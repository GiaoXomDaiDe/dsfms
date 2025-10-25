import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SubjectType } from '~/shared/models/shared-subject.model'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedSubjectRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findIds(where: Prisma.SubjectWhereInput): Promise<string[]> {
    const subjectIds = await this.prismaService.subject.findMany({
      where,
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

  async checkCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.SubjectWhereInput = {
      code,
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
}
