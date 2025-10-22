import z from 'zod'
import { AssessmentStatus, AssessmentResult, AssessmentSectionStatus } from '@prisma/client'

// Base Assessment Form Schema matching Prisma model
export const AssessmentFormSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().max(255),
  subjectId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  occuranceDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdById: z.string().uuid(),
  updatedById: z.string().uuid(),
  traineeId: z.string().uuid(),
  status: z.nativeEnum(AssessmentStatus),
  submittedAt: z.coerce.date().nullable(),
  comment: z.string().max(1000).nullable(),
  approvedById: z.string().uuid().nullable(),
  approvedAt: z.coerce.date().nullable(),
  isTraineeLocked: z.boolean(),
  resultScore: z.number().nullable(),
  resultText: z.nativeEnum(AssessmentResult).nullable(),
  pdfUrl: z.string().max(500).nullable()
})

export type AssessmentFormType = z.infer<typeof AssessmentFormSchema>

// Base Assessment Section Schema
export const AssessmentSectionSchema = z.object({
  id: z.string().uuid(),
  assessmentFormId: z.string().uuid(),
  assessedById: z.string().uuid().nullable(),
  templateSectionId: z.string().uuid(),
  createdAt: z.coerce.date(),
  status: z.nativeEnum(AssessmentSectionStatus)
})

export type AssessmentSectionType = z.infer<typeof AssessmentSectionSchema>

// Base Assessment Value Schema
export const AssessmentValueSchema = z.object({
  id: z.string().uuid(),
  assessmentSectionId: z.string().uuid(),
  templateFieldId: z.string().uuid(),
  answerValue: z.string().max(2000).nullable(),
  createdAt: z.coerce.date(),
  createdById: z.string().uuid()
})

export type AssessmentValueType = z.infer<typeof AssessmentValueSchema>

// ===== CREATE ASSESSMENT REQUEST SCHEMAS =====

// Schema for creating assessments for specific trainees
export const CreateAssessmentBodySchema = z.object({
  templateId: z.string().uuid('Template ID must be a valid UUID'),
  subjectId: z.string().uuid('Subject ID must be a valid UUID').optional(),
  courseId: z.string().uuid('Course ID must be a valid UUID').optional(),
  occuranceDate: z.coerce.date('Occurrence date must be a valid date'),
  name: z.string().min(1, 'Assessment name is required').max(255, 'Assessment name must not exceed 255 characters'),
  traineeIds: z.array(z.string().uuid('Trainee ID must be a valid UUID')).min(1, 'At least one trainee must be specified')
}).refine(
  (data) => data.subjectId || data.courseId,
  {
    message: 'Either subjectId or courseId must be provided',
    path: ['subjectId']
  }
)

export type CreateAssessmentBodyType = z.infer<typeof CreateAssessmentBodySchema>

// Schema for creating assessments for ALL enrolled trainees in a course/subject
export const CreateBulkAssessmentBodySchema = z.object({
  templateId: z.string().uuid('Template ID must be a valid UUID'),
  subjectId: z.string().uuid('Subject ID must be a valid UUID').optional(),
  courseId: z.string().uuid('Course ID must be a valid UUID').optional(),
  occuranceDate: z.coerce.date('Occurrence date must be a valid date'),
  name: z.string().min(1, 'Assessment name is required').max(255, 'Assessment name must not exceed 255 characters'),
  excludeTraineeIds: z.array(z.string().uuid('Trainee ID must be a valid UUID')).optional().default([])
}).refine(
  (data) => data.subjectId || data.courseId,
  {
    message: 'Either subjectId or courseId must be provided',
    path: ['subjectId']
  }
).refine(
  (data) => !(data.subjectId && data.courseId),
  {
    message: 'Cannot provide both subjectId and courseId, only one is allowed',
    path: ['courseId']
  }
)

export type CreateBulkAssessmentBodyType = z.infer<typeof CreateBulkAssessmentBodySchema>

// ===== RESPONSE SCHEMAS =====

// Assessment Form with relations for response
export const AssessmentFormResSchema = AssessmentFormSchema.extend({
  template: z.object({
    id: z.string(),
    name: z.string(),
    version: z.number(),
    department: z.object({
      id: z.string(),
      name: z.string(),
      code: z.string()
    })
  }),
  trainee: z.object({
    id: z.string(),
    eid: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string()
  }),
  subject: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    course: z.object({
      id: z.string(),
      name: z.string(),
      code: z.string()
    })
  }).nullable(),
  course: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    department: z.object({
      id: z.string(),
      name: z.string(),
      code: z.string()
    })
  }).nullable(),
  createdBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string()
  }),
  approvedBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string()
  }).nullable()
})

export type AssessmentFormResType = z.infer<typeof AssessmentFormResSchema>

// Create Assessment Response Schema
export const CreateAssessmentResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessments: z.array(AssessmentFormResSchema),
  totalCreated: z.number()
})

export type CreateAssessmentResType = z.infer<typeof CreateAssessmentResSchema>

// Bulk Assessment Response Schema with additional info
export const CreateBulkAssessmentResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessments: z.array(AssessmentFormResSchema),
  totalCreated: z.number(),
  totalEnrolled: z.number(),
  skippedTrainees: z.array(z.object({
    traineeId: z.string(),
    traineeName: z.string(),
    reason: z.string()
  })),
  entityInfo: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    type: z.enum(['subject', 'course'])
  })
})

export type CreateBulkAssessmentResType = z.infer<typeof CreateBulkAssessmentResSchema>

// Assessment Section with Template Section info
export const AssessmentSectionResSchema = AssessmentSectionSchema.extend({
  templateSection: z.object({
    id: z.string(),
    label: z.string(),
    displayOrder: z.number(),
    editBy: z.string(),
    roleInSubject: z.string().nullable(),
    isSubmittable: z.boolean(),
    isToggleDependent: z.boolean()
  }),
  assessedBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string()
  }).nullable()
})

export type AssessmentSectionResType = z.infer<typeof AssessmentSectionResSchema>

// Assessment Value with Template Field info
export const AssessmentValueResSchema = AssessmentValueSchema.extend({
  templateField: z.object({
    id: z.string(),
    label: z.string(),
    fieldName: z.string(),
    fieldType: z.string(),
    roleRequired: z.string().nullable(),
    options: z.any().nullable(),
    displayOrder: z.number()
  }),
  createdBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string()
  })
})

export type AssessmentValueResType = z.infer<typeof AssessmentValueResSchema>

// ===== QUERY SCHEMAS =====

export const GetAssessmentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.nativeEnum(AssessmentStatus).optional(),
  templateId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  traineeId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  includeDeleted: z.coerce.boolean().default(false).optional()
}).strict()

export type GetAssessmentsQueryType = z.infer<typeof GetAssessmentsQuerySchema>

export const GetAssessmentParamsSchema = z.object({
  assessmentId: z.string().uuid('Assessment ID must be a valid UUID')
}).strict()

export type GetAssessmentParamsType = z.infer<typeof GetAssessmentParamsSchema>

// List Assessments Response
export const GetAssessmentsResSchema = z.object({
  assessments: z.array(AssessmentFormResSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number()
})

export type GetAssessmentsResType = z.infer<typeof GetAssessmentsResSchema>

// Single Assessment Detail Response
export const GetAssessmentDetailResSchema = AssessmentFormResSchema.extend({
  sections: z.array(AssessmentSectionResSchema.extend({
    values: z.array(AssessmentValueResSchema)
  }))
})

export type GetAssessmentDetailResType = z.infer<typeof GetAssessmentDetailResSchema>