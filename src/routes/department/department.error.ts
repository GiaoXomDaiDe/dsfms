import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common'

// Lỗi tồn tại / trùng lặp phòng ban
export const DepartmentAlreadyExistsException = new UnprocessableEntityException([
  {
    message: 'Department already exists',
    path: 'name'
  }
])

// Lỗi không tìm thấy phòng ban
export const NotFoundDepartmentException = new NotFoundException('Department not found')

// Lỗi khi phòng ban vẫn còn liên kết hoạt động (course/trainer/trainee) nên không thể disable
export const DepartmentDisableHasActiveEntitiesException = ({
  courseCount,
  trainerCount,
  traineeCount
}: {
  courseCount: number
  trainerCount: number
  traineeCount: number
}) =>
  new ForbiddenException({
    message: 'Cannot disable department that still has active courses, trainers, or trainees',
    courseCount,
    trainerCount,
    traineeCount
  })

// Lỗi liên quan đến department head
export const InvalidDepartmentHeadException = new UnprocessableEntityException([
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
export const DepartmentHeadAlreadyAssignedException = new BadRequestException(
  'Department head is already assigned to another department'
)

// Lỗi phân quyền kích hoạt phòng ban
export const OnlyAdministratorCanEnableDepartmentException = new ForbiddenException(
  'Only administrators can enable departments'
)
export const DepartmentAlreadyActiveException = new BadRequestException('Department is already active')

// Lỗi khi thao tác với trainer trong phòng ban
export const TrainersNotFoundOrInvalidRoleException = (trainerEids: string[]) =>
  new BadRequestException({
    message: 'Trainers not found or missing TRAINER role',
    trainerEids
  })

export const TrainersAlreadyInDepartmentException = (trainerEids: string[]) =>
  new BadRequestException({
    message: 'Trainers already belong to this department',
    trainerEids
  })

export const TrainersBelongToOtherDepartmentsException = (trainerEids: string[]) =>
  new BadRequestException({
    message: 'Trainers already belong to other departments',
    trainerEids
  })

export const NoTrainersFoundInDepartmentException = new BadRequestException(
  'No trainers found in this department with the provided EIDs'
)

export const TrainersNotInDepartmentException = (trainerEids: string[]) =>
  new BadRequestException({
    message: 'Trainers not found in this department',
    trainerEids
  })
