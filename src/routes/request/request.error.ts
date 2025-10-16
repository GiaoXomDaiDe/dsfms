import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

export const RequestNotFoundException = new NotFoundException('Request not found')

export const RequestAlreadyResolvedException = new BadRequestException('Request is already resolved')

export const RequestManagerAssignmentNotAllowedException = new ForbiddenException(
  'You do not have permission to manage this request'
)

export const RequestInvalidStatusTransitionException = new BadRequestException('Invalid request status transition')

export const RequestAssessmentNotFoundException = new NotFoundException('Assessment form not found for this request')
