import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class SharedSubjectRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findIds(where: Prisma.SubjectWhereInput): Promise<string[]> {
    const subjects = await this.prismaService.subject.findMany({
      where,
      select: { id: true }
    })

    return subjects.map((subject) => subject.id)
  }
}
