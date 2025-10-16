import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

// Lỗi xác thực và tồn tại dữ liệu course
export const CourseNotFoundException = new NotFoundException('Course not found')
export const CourseCodeAlreadyExistsException = new BadRequestException('Course code already exists')
export const DepartmentNotFoundException = new NotFoundException('Department not found')
export const InvalidDateRangeException = new BadRequestException('End date must be after start date')

// Lỗi phân quyền thao tác trên course
export const OnlyAcademicDepartmentCanAccessCourseListException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can access course list'
)
export const OnlyAcademicDepartmentCanCreateCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can create courses'
)
export const OnlyAcademicDepartmentCanUpdateCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can update courses'
)
export const OnlyAcademicDepartmentCanDeleteCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can delete courses'
)
export const OnlyAcademicDepartmentCanArchiveCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can archive courses'
)
export const OnlyAcademicDepartmentCanRestoreCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can restore courses'
)
export const OnlyAcademicDepartmentCanAddSubjectsToCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can add subjects to courses'
)
export const OnlyAcademicDepartmentCanRemoveSubjectsFromCourseException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can remove subjects from courses'
)
// Lỗi ràng buộc nghiệp vụ course
export const CannotHardDeleteCourseWithActiveSubjectsException = new BadRequestException(
  'Cannot permanently delete course with active subjects'
)
export const CourseIsNotDeletedException = new BadRequestException('Course is not deleted')
export const CannotRestoreCourseCodeConflictException = new BadRequestException(
  'Cannot restore course: code conflicts with existing active course'
)
