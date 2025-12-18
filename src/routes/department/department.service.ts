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
  NotFoundDepartmentException
} from '~/routes/department/department.error'
import { DepartmentMes } from '~/routes/department/department.message'
import {
  CreateDepartmentBodyType,
  DepartmentDetailResType,
  DepartmentType,
  GetDepartmentHeadsResType,
  GetDepartmentsResType,
  UpdateDepartmentBodyType
} from '~/routes/department/department.model'
import { DepartmentRepository } from '~/routes/department/department.repo'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
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

  async list(): Promise<GetDepartmentsResType> {
    return await this.departmentRepo.list()
  }

  async findById(id: string): Promise<DepartmentDetailResType> {
    const department = await this.departmentRepo.findById(id)

    if (!department) {
      throw NotFoundDepartmentException
    }

    return department
  }

  async getMyDepartment(userId: string): Promise<DepartmentDetailResType> {
    const user = await this.sharedUserRepo.findUniqueIncludeProfile(userId)

    if (!user || user.deletedAt || user.status === UserStatus.DISABLED) {
      throw NotFoundDepartmentException
    }

    // 1) Ưu tiên department gán trực tiếp cho user
    const departmentIdFromUser = user.department?.id
    if (departmentIdFromUser) {
      const department = await this.departmentRepo.findById(departmentIdFromUser)
      if (department) {
        return department
      }
    }

    throw NotFoundDepartmentException
  }

  async create({
    data,
    createdById
  }: {
    data: CreateDepartmentBodyType
    createdById: string
  }): Promise<DepartmentType> {
    return await this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
      let validatedHead: { id: string; departmentId: string | null } | null = null

      if (data.headUserId) {
        validatedHead = await this.validateDepartmentHead(data.headUserId)
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

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateDepartmentBodyType
    updatedById: string
  }): Promise<DepartmentType> {
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

  async delete({ id, deletedById }: { id: string; deletedById: string }): Promise<{ message: string }> {
    try {
      const [department, activeCourseCount, activeSubjectCount] = await Promise.all([
        this.prismaService.department.findUnique({
          where: {
            id,
            deletedAt: null
          },
          select: {
            headUserId: true
          }
        }),
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

      if (!department) {
        throw NotFoundDepartmentException
      }

      if (activeCourseCount > 0 || activeSubjectCount > 0) {
        throw DepartmentHasActiveCoursesException
      }

      await this.departmentRepo.delete({
        id,
        deletedById
      })

      if (department.headUserId) {
        await Promise.all([
          this.prismaService.user.update({
            where: { id: department.headUserId },
            data: {
              departmentId: null,
              updatedById: deletedById
            }
          }),
          this.prismaService.department.update({
            where: { id },
            data: {
              headUserId: null,
              updatedById: deletedById
            }
          })
        ])
      }

      return {
        message: DepartmentMes.DELETE_SUCCESS
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }

      throw error
    }
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<{ message: string }> {
    try {
      const department = await this.departmentRepo.findById(id)
      if (!department) {
        throw NotFoundDepartmentException
      }

      if (!department.deletedAt || department.isActive) {
        throw DepartmentAlreadyActiveException
      }

      await this.departmentRepo.enable({ id, enabledById })

      return {
        message: DepartmentMes.ENABLE_SUCCESS
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }

      throw error
    }
  }

  getDepartmentHeads(): Promise<GetDepartmentHeadsResType> {
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
  /**
   * Kiểm tra một user có hợp lệ để làm head của department hay không.
   *
   * - `headUserId`: user muốn gán làm head.
   * - `targetDepartmentId` (optional): id department đang update; dùng để cho phép giữ nguyên head hiện tại.
   *
   * Ném exception nếu:
   * - User không tồn tại / không có role DEPARTMENT_HEAD / role không active hoặc user bị xoá mềm.
   * - User đang thuộc một department khác với `targetDepartmentId`.
   * - User đang là head của một department khác (không phải `targetDepartmentId`).
   *
   * Trả về id user và departmentId hiện tại (nếu có) để caller quyết định có cần cập nhật lại departmentId cho user hay không.
   */
  private async validateDepartmentHead(
    headUserId: string,
    targetDepartmentId?: string
  ): Promise<{ id: string; departmentId: string | null }> {
    const user = await this.sharedUserRepo.findUniqueIncludeProfile(headUserId)
    console.log(user)

    if (!user) throw DepartmentHeadUserNotFoundException
    if (user.role.name !== RoleName.DEPARTMENT_HEAD) throw DepartmentHeadMustHaveRoleException
    if (user.role.isActive === false || user.deletedAt) throw DepartmentHeadRoleInactiveException

    // 1) Kiểm tra membership hiện tại (departmentId trên User)
    // - Nếu user đã thuộc department khác (không phải targetDepartmentId) → reject
    if (targetDepartmentId && user.department?.id && user.department.id !== targetDepartmentId) {
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
