import { BadRequestException } from '@nestjs/common'

/**
 * Lỗi khi cố gắng cập nhật thông tin trainer nhưng user không phải là trainer
 */
export const CannotUpdateTrainerProfileException = new BadRequestException(
  'Không thể cập nhật thông tin giảng viên: người dùng không phải là giảng viên'
)

/**
 * Lỗi khi cố gắng cập nhật thông tin trainee nhưng user không phải là trainee
 */
export const CannotUpdateTraineeProfileException = new BadRequestException(
  'Không thể cập nhật thông tin học viên: người dùng không phải là học viên'
)

/**
 * Lỗi khi cố gắng thêm thông tin trainee cho user trainer
 */
export const TrainerCannotHaveTraineeProfileException = new BadRequestException(
  'Giảng viên không thể có thông tin học viên'
)

/**
 * Lỗi khi cố gắng thêm thông tin trainer cho user trainee
 */
export const TraineeCannotHaveTrainerProfileException = new BadRequestException(
  'Học viên không thể có thông tin giảng viên'
)

/**
 * Lỗi khi cố gắng cập nhật email đã tồn tại
 */
export const EmailAlreadyExistsException = new BadRequestException('Email đã tồn tại')

/**
 * Lỗi xác nhận mật khẩu mới không khớp
 */
export const PasswordConfirmNotMatchException = new BadRequestException('Mật khẩu mới và xác nhận mật khẩu không khớp')

/**
 * Lỗi mật khẩu cũ không đúng
 */
export const OldPasswordIncorrectException = new BadRequestException('Mật khẩu cũ không đúng')

/**
 * Lỗi không tìm thấy người dùng
 */
export const UserNotFoundException = new BadRequestException('Không tìm thấy người dùng')

/**
 * Lỗi đổi mật khẩu thành công
 */
export const PasswordResetSuccessException = {
  message: 'Đổi mật khẩu thành công'
}
