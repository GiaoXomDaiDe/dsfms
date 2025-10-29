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
 * Lỗi khi cố gắng hủy báo cáo không ở trạng thái SUBMITTED
 */
export const CanOnlyCancelSubmittedReportException = new BadRequestException(
  'Can only cancel reports with SUBMITTED status'
)

/**
 * Lỗi khi cố gắng xác nhận báo cáo không ở trạng thái SUBMITTED
 */
export const CanOnlyAcknowledgeSubmittedReportException = new BadRequestException(
  'Can only acknowledge reports with SUBMITTED status'
)

/**
 * Lỗi khi cố gắng phản hồi báo cáo không ở trạng thái ACKNOWLEDGED
 */
export const CanOnlyRespondAcknowledgedReportException = new BadRequestException(
  'Can only respond to reports with ACKNOWLEDGED status'
)

export const AssessmentRequestCannotBeAcknowledgedException = new BadRequestException(
  'Assessment approval requests skip the acknowledgement step'
)

export const CanOnlyDecideSubmittedAssessmentException = new BadRequestException(
  'Assessment approval requests can only be decided when status is SUBMITTED'
)

export const AssessmentApprovalDecisionInvalidException = new BadRequestException(
  'Assessment approval decision must be APPROVED or REJECTED'
)

export const RespondStatusMustBeResolvedException = new BadRequestException(
  'Only RESOLVED status is allowed when responding to this report type'
)

/**
 * Lỗi khi manager không phải là người đã xác nhận báo cáo (dự phòng - cho tương lai)
 */
export const OnlyAssignedManagerCanRespondException = new ForbiddenException(
  'Only the assigned manager can respond to this report'
)
