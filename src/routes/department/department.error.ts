import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'

export const DepartmentAlreadyExistsException = new UnprocessableEntityException([
  {
    message: 'Department already exists',
    path: 'name'
  }
])

export const NotFoundDepartmentException = new NotFoundException('Department not found')

export const DepartmentHasActiveCoursesException = new ForbiddenException(
  'Cannot delete department with active courses'
)

export const InvalidDepartmentHeadException = new UnprocessableEntityException([
  {
    message: 'Invalid department head user',
    path: 'headUserId'
  }
])
