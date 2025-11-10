import { BadRequestException } from '@nestjs/common'

/**
 * Lỗi khi cố gắng cập nhật thông tin trainer nhưng user không phải là trainer
 */
export const CannotUpdateTrainerProfileException = new BadRequestException(
  'Cannot update trainer information: user is not a trainer'
)

/**
 * Lỗi khi cố gắng cập nhật thông tin trainee nhưng user không phải là trainee
 */
export const CannotUpdateTraineeProfileException = new BadRequestException(
  'Cannot update trainee information: user is not a trainee'
)

/**
 * Lỗi khi cố gắng thêm thông tin trainee cho user trainer
 */
export const TrainerCannotHaveTraineeProfileException = new BadRequestException('Trainer cannot have a trainee profile')

/**
 * Lỗi khi cố gắng thêm thông tin trainer cho user trainee
 */
export const TraineeCannotHaveTrainerProfileException = new BadRequestException('Trainee cannot have a trainer profile')

/**
 * Lỗi khi cố gắng cập nhật email đã tồn tại
 */
export const EmailAlreadyExistsException = new BadRequestException('Email already exists')

/**
 * Lỗi xác nhận mật khẩu mới không khớp
 */
export const PasswordConfirmNotMatchException = new BadRequestException('New password and confirmation do not match')

/**
 * Lỗi mật khẩu cũ không đúng
 */
export const OldPasswordIncorrectException = new BadRequestException('Old password is incorrect')

/**
 * Lỗi không tìm thấy người dùng
 */
export const UserNotFoundException = new BadRequestException('User not found')

/**
 * Lỗi đổi mật khẩu thành công
 */
export const PasswordResetSuccessException = {
  message: 'Password changed successfully'
}
