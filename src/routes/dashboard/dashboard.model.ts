import { AssessmentStatus } from '@prisma/client'
import z from 'zod'

const DepartmentMetricSchema = z.object({
  departmentId: z.uuid(),
  departmentName: z.string().min(1)
})

export const OngoingCourseMetricSchema = DepartmentMetricSchema.extend({
  ongoingCourseCount: z.number().int().nonnegative()
})

export const OngoingEnrollmentMetricSchema = DepartmentMetricSchema.extend({
  ongoingEnrollmentCount: z.number().int().nonnegative()
})

export const AssessmentStatusMetricSchema = z.object({
  status: z.enum(AssessmentStatus),
  count: z.number().int().nonnegative()
})

export const CourseEffectivenessMetricSchema = z.object({
  courseId: z.uuid(),
  courseName: z.string().min(1),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  totalApproved: z.number().int().nonnegative()
})

export const TrainingEffectivenessMetricSchema = DepartmentMetricSchema.extend({
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  totalApproved: z.number().int().nonnegative(),
  courses: z.array(CourseEffectivenessMetricSchema)
})

export const AcademicOverviewResSchema = z.object({
  ongoingCourseByDepartment: z.array(OngoingCourseMetricSchema),
  ongoingEnrollmentByDepartment: z.array(OngoingEnrollmentMetricSchema),
  assessmentStatusDistribution: z.array(AssessmentStatusMetricSchema),
  trainingEffectivenessByDepartment: z.array(TrainingEffectivenessMetricSchema)
})

export const TraineeAssessmentProgressSchema = z.object({
  approvedCount: z.number().int().nonnegative(),
  totalAssigned: z.number().int().nonnegative(),
  completionRate: z.number().min(0).max(1)
})

export const TraineeOngoingTrainingSchema = z.object({
  ongoingCourses: z.number().int().nonnegative(),
  ongoingSubjects: z.number().int().nonnegative()
})

export const TraineeAssessmentRatioSchema = z.object({
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  totalAssessments: z.number().int().nonnegative(),
  passRatio: z.number().min(0).max(1),
  failRatio: z.number().min(0).max(1)
})

export const TraineeDashboardResSchema = z.object({
  assessmentProgress: TraineeAssessmentProgressSchema,
  ongoingTraining: TraineeOngoingTrainingSchema,
  assessmentRatios: TraineeAssessmentRatioSchema
})

export type DepartmentMetricType = z.infer<typeof DepartmentMetricSchema>
export type OngoingCourseMetricType = z.infer<typeof OngoingCourseMetricSchema>
export type OngoingEnrollmentMetricType = z.infer<typeof OngoingEnrollmentMetricSchema>
export type AssessmentStatusMetricType = z.infer<typeof AssessmentStatusMetricSchema>
export type CourseEffectivenessMetricType = z.infer<typeof CourseEffectivenessMetricSchema>
export type TrainingEffectivenessMetricType = z.infer<typeof TrainingEffectivenessMetricSchema>
export type AcademicOverviewResType = z.infer<typeof AcademicOverviewResSchema>
export type TraineeAssessmentProgressType = z.infer<typeof TraineeAssessmentProgressSchema>
export type TraineeOngoingTrainingType = z.infer<typeof TraineeOngoingTrainingSchema>
export type TraineeAssessmentRatioType = z.infer<typeof TraineeAssessmentRatioSchema>
export type TraineeDashboardResType = z.infer<typeof TraineeDashboardResSchema>
