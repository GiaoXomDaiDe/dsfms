import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import {
  DepartmentAlreadyActiveException,
  DepartmentAlreadyExistsException,
  DepartmentCodeAlreadyExistsException,
  DepartmentHasActiveCoursesException,
  DepartmentHeadBelongsToAnotherDepartmentException,
  DepartmentHeadMustHaveRoleException,
  DepartmentHeadRoleInactiveException,
  DepartmentHeadUserNotFoundException,
  DepartmentNameAlreadyExistsException,
  NotFoundDepartmentException,
  OnlyAdministratorCanEnableDepartmentException
} from '~/routes/department/department.error'
import { CreateDepartmentBodyType, UpdateDepartmentBodyType } from '~/routes/department/department.model'
import { DepartmentRepository } from '~/routes/department/department.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class DepartmentService {
  constructor(
    private readonly departmentRepo: DepartmentRepository,
    private readonly prismaService: PrismaService,
    private readonly sharedUserRepo: SharedUserRepository
  ) {}

  async list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    return await this.departmentRepo.list({
      includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
    })
  }

  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    try {
      const department = await this.departmentRepo.findById(id, {
        includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
      })

      if (!department) {
        throw NotFoundDepartmentException
      }

      return department
    } catch (error) {
      throw NotFoundDepartmentException
    }
  }

  async create({ data, createdById }: { data: CreateDepartmentBodyType; createdById: string }) {
    return await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
      let validatedHead: { id: string; departmentId: string | null } | null = null

      if (data.headUserId) {
        validatedHead = await this.validateDepartmentHead(data.headUserId)
        if (validatedHead.departmentId) {
          throw DepartmentHeadBelongsToAnotherDepartmentException
        }
      }
      try {
        const department = await this.departmentRepo.create(
          {
            createdById,
            data
          },
          tx
        )

        if (validatedHead && validatedHead.departmentId === null) {
          await tx.user.update({
            where: { id: validatedHead.id },
            data: {
              departmentId: department.id,
              updatedById: createdById
            }
          })
        }

        return department
      } catch (error) {
        if (isUniqueConstraintPrismaError(error)) {
          this.handleDepartmentUniqueConstraintError(error)
        }

        throw error
      }
    })
  }

  async update({ id, data, updatedById }: { id: string; data: UpdateDepartmentBodyType; updatedById: string }) {
    try {
      return await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingDepartment = await tx.department.findUnique({
          where: {
            id,
            deletedAt: null
          },
          select: {
            headUserId: true
          }
        })

        if (!existingDepartment) throw NotFoundDepartmentException

        let validatedHead: { id: string; departmentId: string | null } | null = null

        if (data.headUserId) {
          // kiểm tra user có đủ điều kiện làm head cho department id
          validatedHead = await this.validateDepartmentHead(data.headUserId, id)
        }

        const department = await this.departmentRepo.update(
          {
            id,
            updatedById,
            data
          },
          tx
        )

        // Nếu có head mới khác với head cũ -> clear departmentId của head cũ
        if (
          validatedHead && // có head mới
          existingDepartment.headUserId && // trước đó có head cũ
          existingDepartment.headUserId !== validatedHead.id // head mới khác head cũ
        ) {
          await tx.user.update({
            where: { id: existingDepartment.headUserId },
            data: {
              departmentId: null,
              updatedById
            }
          })
        }

        // Đảm bảo head mới luôn có departmentId = id
        if (validatedHead && validatedHead.departmentId !== id) {
          await tx.user.update({
            where: { id: validatedHead.id },
            data: {
              departmentId: id,
              updatedById
            }
          })
        }

        return department
      })
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }

      if (isUniqueConstraintPrismaError(error)) {
        this.handleDepartmentUniqueConstraintError(error)
      }

      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }) {
    try {
      const [activeCourseCount, activeSubjectCount] = await Promise.all([
        this.prismaService.course.count({
          where: {
            departmentId: id,
            deletedAt: null
          }
        }),
        this.prismaService.subject.count({
          where: {
            deletedAt: null,
            course: {
              departmentId: id,
              deletedAt: null
            }
          }
        })
      ])

      if (activeCourseCount > 0 || activeSubjectCount > 0) {
        throw DepartmentHasActiveCoursesException
      }

      await this.departmentRepo.delete({
        id,
        deletedById
      })

      return {
        message: 'Disable successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }

      throw error
    }
  }

  async enable({ id, enabledById, enablerRole }: { id: string; enabledById: string; enablerRole: string }) {
    if (enablerRole !== RoleName.ADMINISTRATOR) {
      throw OnlyAdministratorCanEnableDepartmentException
    }

    try {
      const department = await this.departmentRepo.findById(id, { includeDeleted: true })
      if (!department) {
        throw NotFoundDepartmentException
      }

      if (!department.deletedAt) {
        throw DepartmentAlreadyActiveException
      }

      await this.departmentRepo.enable({ id, enabledById })

      return {
        message: 'Enable department successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }

      throw error
    }
  }

  getDepartmentHeads() {
    return this.departmentRepo.getDepartmentHeads()
  }

  private handleDepartmentUniqueConstraintError(error: PrismaClientKnownRequestError): never {
    const targetMeta = error.meta?.target
    const normalizedTargets = Array.isArray(targetMeta)
      ? targetMeta.map((value) => value?.toString().toLowerCase())
      : typeof targetMeta === 'string'
        ? [targetMeta.toLowerCase()]
        : []

    if (normalizedTargets.some((target) => target?.includes('code'))) {
      throw DepartmentCodeAlreadyExistsException
    }

    if (normalizedTargets.some((target) => target?.includes('name'))) {
      throw DepartmentNameAlreadyExistsException
    }

    throw DepartmentAlreadyExistsException
  }

  private async validateDepartmentHead(headUserId: string, targetDepartmentId?: string) {
    const user = await this.sharedUserRepo.findUniqueIncludeProfile(headUserId)

    if (!user) throw DepartmentHeadUserNotFoundException
    if (user.role.name !== RoleName.DEPARTMENT_HEAD) throw DepartmentHeadMustHaveRoleException
    if (user.role.isActive === false) throw DepartmentHeadRoleInactiveException

    // 1) Kiểm tra membership hiện tại (departmentId trên User)
    // - Nếu user đã thuộc department khác (không phải targetDepartmentId) → reject
    if (user.department?.id && user.department.id !== targetDepartmentId) {
      throw DepartmentHeadBelongsToAnotherDepartmentException
    }

    // 2) (tuỳ chọn nhưng khuyến khích) Kiểm tra head theo headUserId, phòng tránh drift dữ liệu
    //    Dùng PrismaService trực tiếp, không qua repo để tránh circular.
    const existingHeadOfDepartment = await this.prismaService.department.findFirst({
      where: {
        headUserId: headUserId,
        deletedAt: null,
        // Nếu đang update cùng department thì cho phép (tránh tự chặn chính mình)
        NOT: targetDepartmentId ? { id: targetDepartmentId } : undefined
      },
      select: { id: true }
    })

    if (existingHeadOfDepartment) {
      // Nếu user đã là head của department khác
      throw DepartmentHeadBelongsToAnotherDepartmentException
    }

    return {
      id: user.id,
      departmentId: user.department?.id ?? null
    }
  }
}
