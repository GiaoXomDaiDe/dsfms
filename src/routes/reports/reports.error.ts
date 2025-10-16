import { BadRequestException, NotFoundException } from '@nestjs/common'

export class ReportNotFoundError extends NotFoundException {
  constructor() {
    super('Report not found')
  }
}

export class UnauthorizedReportAccessError extends BadRequestException {
  constructor() {
    super('You can only access your own reports')
  }
}

export class InvalidReportStatusError extends BadRequestException {
  constructor(action: string, currentStatus: string, requiredStatus: string) {
    super(`Cannot ${action} report. Current status is ${currentStatus}, but required status is ${requiredStatus}`)
  }
}

export class ReportAlreadyProcessedError extends BadRequestException {
  constructor() {
    super('Report has already been processed and cannot be modified')
  }
}
