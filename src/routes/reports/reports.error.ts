import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

/**
 * Lỗi khi không tìm thấy báo cáo
 */
export const ReportNotFoundException = new NotFoundException('Report not found')

/**
 * Lỗi khi cố gắng hủy báo cáo của người khác
 */
export const CanOnlyCancelOwnReportException = new ForbiddenException('You can only cancel your own reports')

/**
 * Lỗi khi cố gắng hủy báo cáo không ở trạng thái CREATED
 */
export const CanOnlyCancelCreatedReportException = new BadRequestException(
  'Can only cancel reports with CREATED status'
)

/**
 * Lỗi khi cố gắng xác nhận báo cáo không ở trạng thái CREATED
 */
export const CanOnlyAcknowledgeCreatedReportException = new BadRequestException(
  'Can only acknowledge reports with CREATED status'
)

/**
 * Lỗi khi cố gắng phản hồi báo cáo không ở trạng thái ACKNOWLEDGED
 */
export const CanOnlyRespondAcknowledgedReportException = new BadRequestException(
  'Can only respond to reports with ACKNOWLEDGED status'
)

/**
 * Lỗi khi manager không phải là người đã xác nhận báo cáo (dự phòng - cho tương lai)
 */
export const OnlyAssignedManagerCanRespondException = new ForbiddenException(
  'Only the assigned manager can respond to this report'
)
