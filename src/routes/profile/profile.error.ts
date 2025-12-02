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
 * Lỗi khi không thể truy cập thông tin hồ sơ (có thể do user đã bị xoá hoặc không tồn tại)
 */
export const ProfileNotAccessibleException = new BadRequestException('Profile is unavailable')

/**
 * Lỗi khi không cung cấp avatar url hoặc file
 */
export const AvatarSourceMissingException = new BadRequestException('Avatar file or URL is required')

/**
 * Lỗi khi file avatar không phải là định dạng ảnh
 */
export const AvatarInvalidFormatException = new BadRequestException('Avatar must be an image file')

/**
 * Lỗi khi upload avatar lên S3 thất bại
 */
export const AvatarUploadFailedException = new BadRequestException('Unable to upload avatar image')
