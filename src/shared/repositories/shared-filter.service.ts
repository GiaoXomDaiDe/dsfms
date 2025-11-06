import { Injectable } from '@nestjs/common'

export interface BuildListFiltersOptions {
  includeDeleted?: boolean
  deletedColumn?: string
  baseFilters?: Record<string, unknown>
  extend?: (context: { includeDeleted: boolean }) => Record<string, unknown>
}

@Injectable()
export class SharedFilterService {
  buildListFilters({
    includeDeleted = true,
    deletedColumn = 'deletedAt',
    baseFilters = {},
    extend
  }: BuildListFiltersOptions = {}): Record<string, unknown> {
    const filters: Record<string, unknown> = { ...baseFilters }

    if (!includeDeleted) {
      filters[deletedColumn] = null
    }

    if (extend) {
      Object.assign(filters, extend({ includeDeleted }))
    }

    return filters
  }
}
