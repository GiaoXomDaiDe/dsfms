import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class SharedSubjectEnrollmentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findMany<T extends Prisma.SubjectEnrollmentSelect>({
    where,
    select
  }: {
    where: Prisma.SubjectEnrollmentWhereInput
    select: T
  }): Promise<Array<Prisma.SubjectEnrollmentGetPayload<{ select: T }>>> {
    return this.prismaService.subjectEnrollment.findMany({
      where,
      select
    })
  }

  async updateMany({
    where,
    data
  }: {
    where: Prisma.SubjectEnrollmentWhereInput
    data: Prisma.SubjectEnrollmentUpdateManyMutationInput
  }): Promise<number> {
    const { count } = await this.prismaService.subjectEnrollment.updateMany({
      where,
      data
    })

    return count
  }

  async count(where: Prisma.SubjectEnrollmentWhereInput): Promise<number> {
    return this.prismaService.subjectEnrollment.count({ where })
  }
}
