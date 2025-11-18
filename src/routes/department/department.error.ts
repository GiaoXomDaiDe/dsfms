import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ValidationException } from '~/shared/exceptions/validation.exception'

// Lỗi tồn tại / trùng lặp phòng ban
export const DepartmentAlreadyExistsException = new ValidationException([
  {
    message: 'Department already exists',
    path: 'name'
  }
])

// Lỗi không tìm thấy phòng ban
export const NotFoundDepartmentException = new NotFoundException('Department not found')

// Lỗi khi cố gắng xóa phòng ban đang có course hoạt động
export const DepartmentHasActiveCoursesException = new ForbiddenException(
  'Cannot delete department while courses or subjects are still active'
)

// Lỗi liên quan đến department head
export const InvalidDepartmentHeadException = new ValidationException([
  {
    message: 'Invalid department head user',
    path: 'headUserId'
  }
])
export const DepartmentHeadUserNotFoundException = new NotFoundException('Department head user not found')
export const DepartmentHeadMustHaveRoleException = new BadRequestException(
  'User must have DEPARTMENT_HEAD role to be assigned as department head'
)
export const DepartmentHeadRoleInactiveException = new BadRequestException('Department head role must be active')

// Lỗi phân quyền kích hoạt phòng ban
export const OnlyAdministratorCanEnableDepartmentException = new ForbiddenException(
  'Only administrators can enable departments'
)
export const DepartmentAlreadyActiveException = new BadRequestException('Department is already active')

export const DepartmentHeadBelongsToAnotherDepartmentException = new BadRequestException(
  'This department head belongs to another department, choose a head within this department'
)
