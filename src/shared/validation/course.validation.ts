import z from 'zod'
import { CourseStatus, LevelStatus } from '~/shared/constants/course.constant'
import { BASIC_TEXT_REGEX, CODE_TEXT_REGEX } from '~/shared/constants/validation.constant'
import { createEnumSchema, nullableNumberField, requiredText } from '~/shared/helpers/zod-validation.helper'

const LEVEL_STATUS_ERROR_MESSAGE = `Status must be one of: ${[LevelStatus.BEGINNER, LevelStatus.INTERMEDIATE, LevelStatus.ADVANCED].join(', ')}`
const COURSE_STATUS_ERROR_MESSAGE = `Status must be one of: ${[CourseStatus.PLANNED, CourseStatus.ON_GOING, CourseStatus.COMPLETED, CourseStatus.ARCHIVED].join(', ')}`
const COURSE_NAME_MESSAGE = 'Course name invalid'
const COURSE_CODE_MESSAGE = 'Course code invalid'

export const courseLevelSchema = createEnumSchema(
  [LevelStatus.BEGINNER, LevelStatus.INTERMEDIATE, LevelStatus.ADVANCED],
  LEVEL_STATUS_ERROR_MESSAGE
)

export const courseStatusSchema = createEnumSchema(
  [CourseStatus.PLANNED, CourseStatus.ON_GOING, CourseStatus.COMPLETED, CourseStatus.ARCHIVED],
  COURSE_STATUS_ERROR_MESSAGE
)

export const coursePassScoreSchema = nullableNumberField(z.number().min(0).max(100))

export const courseNameSchema = requiredText({
  field: 'Course name',
  max: 255,
  options: {
    pattern: BASIC_TEXT_REGEX,
    message: COURSE_NAME_MESSAGE
  }
})

export const courseCodeSchema = requiredText({
  field: 'Course code',
  max: 20,
  options: {
    pattern: CODE_TEXT_REGEX,
    message: COURSE_CODE_MESSAGE
  }
})
