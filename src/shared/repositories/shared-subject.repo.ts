import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
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
}
