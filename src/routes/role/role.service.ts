import { Injectable } from '@nestjs/common'
import {
  NotFoundRoleException,
  ProhibitedActionOnBaseRoleException,
  RoleAlreadyExistsException
} from '~/routes/role/role.error'
import { CreateRoleBodyType, UpdateRoleBodyType } from '~/routes/role/role.model'
import { RoleRepo } from '~/routes/role/role.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'

@Injectable()
export class RoleService {
  constructor(private roleRepo: RoleRepo) {}

  async list() {
    const data = await this.roleRepo.list()
    return data
  }

  async findById(id: string) {
    const role = await this.roleRepo.findById(id)
    if (!role) {
      throw NotFoundRoleException
    }
    return role
  }

  async create({ data, createdById }: { data: CreateRoleBodyType; createdById: string }) {
    try {
      const role = await this.roleRepo.create({
        createdById,
        data
      })
      return role
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw RoleAlreadyExistsException
      }
      throw error
    }
  }

  /**
   * Kiểm tra xem role có phải là 1 trong 3 role cơ bản không
   */
  private async verifyRole(roleId: string) {
    const role = await this.roleRepo.findById(roleId)
    if (!role) {
      throw NotFoundRoleException
    }
    const baseRoles: string[] = [
      RoleName.ADMINISTRATOR,
      RoleName.DEPARTMENT_HEAD,
      RoleName.SQA_AUDITOR,
      RoleName.TRAINEE,
      RoleName.TRAINER
    ]

    if (baseRoles.includes(role.name)) {
      throw ProhibitedActionOnBaseRoleException
    }
  }

  async update({ id, data, updatedById }: { id: string; data: UpdateRoleBodyType; updatedById: string }) {
    try {
      await this.verifyRole(id)

      const updatedRole = await this.roleRepo.update({
        id,
        updatedById,
        data
      })
      return updatedRole
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundRoleException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw RoleAlreadyExistsException
      }
      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }) {
    try {
      const role = await this.roleRepo.findById(id)
      if (!role) {
        throw NotFoundRoleException
      }
      // Không cho phép bất kỳ ai có thể xóa 3 role cơ bản này
      const baseRoles: string[] = [
        RoleName.ADMINISTRATOR,
        RoleName.DEPARTMENT_HEAD,
        RoleName.SQA_AUDITOR,
        RoleName.TRAINEE,
        RoleName.TRAINER
      ]
      if (baseRoles.includes(role.name)) {
        throw ProhibitedActionOnBaseRoleException
      }
      await this.roleRepo.delete({
        id,
        deletedById
      })
      return {
        message: 'Delete successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundRoleException
      }
      throw error
    }
  }
}
