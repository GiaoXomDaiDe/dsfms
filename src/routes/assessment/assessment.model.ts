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
export const CreateAssessmentBodySchema = z
  .object({
    templateId: z.string().uuid('Template ID must be a valid UUID'),
    subjectId: z.string().uuid('Subject ID must be a valid UUID').optional(),
    courseId: z.string().uuid('Course ID must be a valid UUID').optional(),
    occuranceDate: z.coerce.date('Occurrence date must be a valid date'),
    name: z.string().min(1, 'Assessment name is required').max(255, 'Assessment name must not exceed 255 characters'),
    traineeIds: z
      .array(z.string().uuid('Trainee ID must be a valid UUID'))
      .min(1, 'At least one trainee must be specified')
  })
  .refine((data) => data.subjectId || data.courseId, {
    message: 'Either subjectId or courseId must be provided',
    path: ['subjectId']
  })

export type CreateAssessmentBodyType = z.infer<typeof CreateAssessmentBodySchema>

// Schema for creating assessments for ALL enrolled trainees in a course/subject
export const CreateBulkAssessmentBodySchema = z
  .object({
    templateId: z.string().uuid('Template ID must be a valid UUID'),
    subjectId: z.string().uuid('Subject ID must be a valid UUID').optional(),
    courseId: z.string().uuid('Course ID must be a valid UUID').optional(),
    occuranceDate: z.coerce.date('Occurrence date must be a valid date'),
    name: z.string().min(1, 'Assessment name is required').max(255, 'Assessment name must not exceed 255 characters'),
    excludeTraineeIds: z.array(z.string().uuid('Trainee ID must be a valid UUID')).optional().default([])
  })
  .refine((data) => data.subjectId || data.courseId, {
    message: 'Either subjectId or courseId must be provided',
    path: ['subjectId']
  })
  .refine((data) => !(data.subjectId && data.courseId), {
    message: 'Cannot provide both subjectId and courseId, only one is allowed',
    path: ['courseId']
  })

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
  subject: z
    .object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      course: z.object({
        id: z.string(),
        name: z.string(),
        code: z.string()
      })
    })
    .nullable(),
  course: z
    .object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      department: z.object({
        id: z.string(),
        name: z.string(),
        code: z.string()
      })
    })
    .nullable(),
  createdBy: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
    email: z.string()
  }),
  approvedBy: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      middleName: z.string().nullable(),
      email: z.string()
    })
    .nullable()
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
  skippedTrainees: z.array(
    z.object({
      traineeId: z.string(),
      traineeName: z.string(),
      reason: z.string()
    })
  ),
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
  assessedBy: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      middleName: z.string().nullable(),
      email: z.string()
    })
    .nullable()
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

export const GetAssessmentsQuerySchema = z
  .object({
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
  })
  .strict()

export type GetAssessmentsQueryType = z.infer<typeof GetAssessmentsQuerySchema>

export const GetDepartmentAssessmentsQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.nativeEnum(AssessmentStatus).optional(),
    templateId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    traineeId: z.string().uuid().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    search: z.string().optional(),
    includeDeleted: z.coerce.boolean().default(false).optional()
  })
  .strict()

export type GetDepartmentAssessmentsQueryType = z.infer<typeof GetDepartmentAssessmentsQuerySchema>

// Department Assessment Item with custom trainee field
export const DepartmentAssessmentItemSchema = AssessmentFormResSchema.extend({
  trainee: z.object({
    id: z.string(),
    eid: z.string(),
    fullName: z.string(), // Custom field combining first, middle, last names
    email: z.string()
  })
})

export type DepartmentAssessmentItemType = z.infer<typeof DepartmentAssessmentItemSchema>

export const GetDepartmentAssessmentsResSchema = z.object({
  assessments: z.array(DepartmentAssessmentItemSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  departmentInfo: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string()
    })
    .optional()
})

export type GetDepartmentAssessmentsResType = z.infer<typeof GetDepartmentAssessmentsResSchema>

export const GetAssessmentParamsSchema = z
  .object({
    assessmentId: z.string().uuid('Assessment ID must be a valid UUID')
  })
  .strict()

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
  sections: z.array(
    AssessmentSectionResSchema.extend({
      values: z.array(AssessmentValueResSchema)
    })
  )
})

export type GetAssessmentDetailResType = z.infer<typeof GetAssessmentDetailResSchema>

// ===== TRAINER ASSESSMENT SCHEMAS =====

// Request schemas for trainer assessment lists
export const GetSubjectAssessmentsQuerySchema = z
  .object({
    subjectId: z.string().uuid('Subject ID must be a valid UUID'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    status: z.nativeEnum(AssessmentStatus).optional(),
    search: z.string().max(255).optional()
  })
  .strict()

export type GetSubjectAssessmentsQueryType = z.infer<typeof GetSubjectAssessmentsQuerySchema>

export const GetCourseAssessmentsQuerySchema = z
  .object({
    courseId: z.string().uuid('Course ID must be a valid UUID'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    status: z.nativeEnum(AssessmentStatus).optional(),
    search: z.string().max(255).optional()
  })
  .strict()

export type GetCourseAssessmentsQueryType = z.infer<typeof GetCourseAssessmentsQuerySchema>

// Assessment list item schema for trainers (basic info only)
export const TrainerAssessmentListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subjectId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  occuranceDate: z.coerce.date(),
  status: z.nativeEnum(AssessmentStatus),
  resultScore: z.number().nullable(),
  resultText: z.nativeEnum(AssessmentResult).nullable(),
  pdfUrl: z.string().nullable(),
  comment: z.string().nullable(),
  isTraineeLocked: z.boolean(),
  trainee: z.object({
    id: z.string().uuid(),
    eid: z.string(),
    fullName: z.string(),
    email: z.string()
  })
})

export type TrainerAssessmentListItemType = z.infer<typeof TrainerAssessmentListItemSchema>

// Response schemas for trainer assessment lists
export const GetSubjectAssessmentsResSchema = z.object({
  assessments: z.array(TrainerAssessmentListItemSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  subjectInfo: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    course: z.object({
      id: z.string(),
      name: z.string(),
      code: z.string()
    })
  })
})

export type GetSubjectAssessmentsResType = z.infer<typeof GetSubjectAssessmentsResSchema>

export const GetCourseAssessmentsResSchema = z.object({
  assessments: z.array(TrainerAssessmentListItemSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  courseInfo: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string()
  })
})

export type GetCourseAssessmentsResType = z.infer<typeof GetCourseAssessmentsResSchema>

// Trainee assessment item schema (without trainee info since it's for the current trainee only)
export const TraineeAssessmentListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subjectId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  occuranceDate: z.coerce.date(),
  status: z.nativeEnum(AssessmentStatus),
  resultScore: z.number().nullable(),
  resultText: z.nativeEnum(AssessmentResult).nullable(),
  pdfUrl: z.string().nullable(),
  comment: z.string().nullable(),
  isTraineeLocked: z.boolean()
})

export type TraineeAssessmentListItemType = z.infer<typeof TraineeAssessmentListItemSchema>

// Trainee assessments query schema (no course/subject filter)
export const GetTraineeAssessmentsQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(1000),
    status: z.nativeEnum(AssessmentStatus).optional(),
    search: z.string().max(255).optional()
  })
  .strict()

export type GetTraineeAssessmentsQueryType = z.infer<typeof GetTraineeAssessmentsQuerySchema>

// Response schema for trainee assessments
export const GetTraineeAssessmentsResSchema = z.object({
  assessments: z.array(TraineeAssessmentListItemSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number()
})

export type GetTraineeAssessmentsResType = z.infer<typeof GetTraineeAssessmentsResSchema>

// Get Assessment Sections for Assessment (for trainers to see what they can assess)
export const GetAssessmentSectionsQuerySchema = z.object({
  assessmentId: z.string().uuid()
})

export type GetAssessmentSectionsQueryType = z.infer<typeof GetAssessmentSectionsQuerySchema>

export const AssessmentSectionDetailSchema = z.object({
  id: z.string().uuid(),
  assessmentFormId: z.string().uuid(),
  assessedById: z.string().uuid().nullable(),
  status: z.nativeEnum(AssessmentSectionStatus),
  createdAt: z.coerce.date(),
  // Template section information
  templateSection: z.object({
    id: z.string().uuid(),
    label: z.string(),
    displayOrder: z.number(),
    editBy: z.string(), // EditByRole enum as string
    roleInSubject: z.string().nullable(), // RoleInSubject enum as string
    isSubmittable: z.boolean(),
    isToggleDependent: z.boolean()
  }),
  // Assessor information (if assessed)
  assessedBy: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      eid: z.string()
    })
    .nullable(),
  // Optional field for TRAINER users
  canAssessed: z.boolean().optional()
})

export type AssessmentSectionDetailType = z.infer<typeof AssessmentSectionDetailSchema>

export const GetAssessmentSectionsResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentInfo: z.object({
    id: z.string().uuid(),
    name: z.string(),
    trainee: z.object({
      id: z.string().uuid(),
      fullName: z.string(),
      eid: z.string(),
      traineeProfile: z.object({
        userId: z.string().uuid().optional(),
        dob: z.coerce.date().nullable().optional(),
        enrollmentDate: z.coerce.date().nullable().optional(),
        trainingBatch: z.string().nullable().optional(),
        passportNo: z.string().nullable().optional(),
        nation: z.string().nullable().optional(),
      }).nullable().optional()
    }),
    template: z.object({
      id: z.string().uuid(),
      name: z.string(),
      templateContent: z.string().nullable().optional()
    }),
    subject: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        code: z.string()
      })
      .nullable(),
    course: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        code: z.string()
      })
      .nullable(),
    occuranceDate: z.coerce.date(),
    status: z.nativeEnum(AssessmentStatus)
  }),
  availableTrainers: z.number(),
  sections: z.array(AssessmentSectionDetailSchema),
  userRole: z.string(),
  // Optional field for TRAINEE users - indicates if assessment is locked
  isTraineeLocked: z.boolean().optional()
})

export type GetAssessmentSectionsResType = z.infer<typeof GetAssessmentSectionsResSchema>

// ===== GET ASSESSMENT SECTION FIELDS API =====

// Query schema for getting assessment section fields
export const GetAssessmentSectionFieldsQuerySchema = z.object({
  assessmentSectionId: z.string().uuid()
})

export type GetAssessmentSectionFieldsQueryType = z.infer<typeof GetAssessmentSectionFieldsQuerySchema>

// Template field detail schema with assessment value
export const AssessmentSectionFieldDetailSchema = z.object({
  templateField: z.object({
    id: z.string().uuid(),
    label: z.string(),
    fieldName: z.string(),
    fieldType: z.string(),
    roleRequired: z.string().nullable(),
    options: z.any().nullable(),
    displayOrder: z.number(),
    parentId: z.string().uuid().nullable()
  }),
  assessmentValue: z.object({
    id: z.string().uuid(),
    answerValue: z.string().nullable()
  })
})

export type AssessmentSectionFieldDetailType = z.infer<typeof AssessmentSectionFieldDetailSchema>

// Response schema for assessment section fields
export const GetAssessmentSectionFieldsResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentSectionInfo: z.object({
    id: z.string().uuid(),
    assessmentFormId: z.string().uuid(),
    templateSectionId: z.string().uuid(),
    status: z.nativeEnum(AssessmentSectionStatus),
    canUpdated: z.boolean(),
    canSave: z.boolean(),
    templateSection: z.object({
      id: z.string().uuid(),
      label: z.string(),
      displayOrder: z.number(),
      editBy: z.string(),
      roleInSubject: z.string().nullable(),
      isSubmittable: z.boolean(),
      isToggleDependent: z.boolean()
    })
  }),
  traineeInfo: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    eid: z.string(),
    middleName: z.string().nullable().optional(),
    traineeProfile: z.object({
      userId: z.string().uuid().optional(),
      dob: z.coerce.date().nullable().optional(),
      enrollmentDate: z.coerce.date().nullable().optional(),
      trainingBatch: z.string().nullable().optional(),
      passportNo: z.string().nullable().optional(),
      nation: z.string().nullable().optional(),
      createdAt: z.coerce.date().nullable().optional(),
      updatedAt: z.coerce.date().nullable().optional(),
      deletedAt: z.coerce.date().nullable().optional(),
      deletedById: z.string().uuid().nullable().optional()
    }).nullable().optional()
  }),
  templateContent: z.string().nullable().optional(),
  fields: z.array(AssessmentSectionFieldDetailSchema),
  totalFields: z.number()
})

export type GetAssessmentSectionFieldsResType = z.infer<typeof GetAssessmentSectionFieldsResSchema>

// ===== SAVE ASSESSMENT VALUES SCHEMAS =====

export const SaveAssessmentValueSchema = z.object({
  assessmentValueId: z.string().uuid('Assessment value ID must be a valid UUID'),
  answerValue: z.string().max(2000, 'Answer value must not exceed 2000 characters').nullable()
})

export const SaveAssessmentValuesBodySchema = z.object({
  assessmentSectionId: z.string().uuid('Assessment section ID must be a valid UUID'),
  values: z.array(SaveAssessmentValueSchema).min(1, 'At least one value must be provided')
})

export const SaveAssessmentValuesResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentSectionId: z.string().uuid(),
  updatedValues: z.number(),
  sectionStatus: z.nativeEnum(AssessmentSectionStatus),
  assessmentFormStatus: z.nativeEnum(AssessmentStatus)
})

export type SaveAssessmentValuesBodyType = z.infer<typeof SaveAssessmentValuesBodySchema>
export type SaveAssessmentValuesResType = z.infer<typeof SaveAssessmentValuesResSchema>

// ===== TOGGLE TRAINEE LOCK SCHEMAS =====

export const ToggleTraineeLockBodySchema = z.object({
  isTraineeLocked: z.boolean()
})

export const ToggleTraineeLockResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentFormId: z.string().uuid(),
  isTraineeLocked: z.boolean(),
  status: z.nativeEnum(AssessmentStatus)
})

export type ToggleTraineeLockBodyType = z.infer<typeof ToggleTraineeLockBodySchema>
export type ToggleTraineeLockResType = z.infer<typeof ToggleTraineeLockResSchema>

// ===== SUBMIT ASSESSMENT SCHEMAS =====

export const SubmitAssessmentParamsSchema = z.object({
  assessmentId: z.string().uuid('Assessment ID must be a valid UUID')
})

export const SubmitAssessmentResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentFormId: z.string().uuid(),
  submittedAt: z.coerce.date(),
  submittedBy: z.string().uuid(),
  status: z.nativeEnum(AssessmentStatus)
})

export type SubmitAssessmentParamsType = z.infer<typeof SubmitAssessmentParamsSchema>
export type SubmitAssessmentResType = z.infer<typeof SubmitAssessmentResSchema>

// ===== UPDATE ASSESSMENT VALUES SCHEMAS =====

export const UpdateAssessmentValuesBodySchema = z.object({
  assessmentSectionId: z.string().uuid('Assessment section ID must be a valid UUID'),
  values: z.array(SaveAssessmentValueSchema).min(1, 'At least one value must be provided')
})

export const UpdateAssessmentValuesResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentSectionId: z.string().uuid(),
  updatedValues: z.number(),
  sectionStatus: z.nativeEnum(AssessmentSectionStatus),
  assessmentFormStatus: z.nativeEnum(AssessmentStatus)
})

export type UpdateAssessmentValuesBodyType = z.infer<typeof UpdateAssessmentValuesBodySchema>
export type UpdateAssessmentValuesResType = z.infer<typeof UpdateAssessmentValuesResSchema>

// ===== CONFIRM ASSESSMENT PARTICIPATION SCHEMAS =====

export const ConfirmAssessmentParticipationBodySchema = z.object({
  traineeSignatureUrl: z.string().min(1, 'Trainee signature URL is required')
})

export const ConfirmAssessmentParticipationResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assessmentFormId: z.string().uuid(),
  traineeId: z.string().uuid(),
  confirmedAt: z.coerce.date(),
  status: z.nativeEnum(AssessmentStatus),
  previousStatus: z.nativeEnum(AssessmentStatus),
  signatureSaved: z.boolean()
})

export type ConfirmAssessmentParticipationBodyType = z.infer<typeof ConfirmAssessmentParticipationBodySchema>
export type ConfirmAssessmentParticipationResType = z.infer<typeof ConfirmAssessmentParticipationResSchema>

// ===== APPROVE/REJECT ASSESSMENT SCHEMAS =====

export const ApproveRejectAssessmentBodySchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED'], {
    message: 'Action must be either APPROVED or REJECTED'
  }),
  comment: z.string().max(1000, 'Comment must not exceed 1000 characters').optional()
})

export const ApproveRejectAssessmentResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    assessmentFormId: z.string().uuid(),
    status: z.nativeEnum(AssessmentStatus),
    previousStatus: z.nativeEnum(AssessmentStatus),
    comment: z.string().nullable(),
    approvedById: z.string().uuid().nullable(),
    approvedAt: z.coerce.date().nullable(),
    processedAt: z.coerce.date(),
    processedBy: z.string().uuid()
  })
})

export type ApproveRejectAssessmentBodyType = z.infer<typeof ApproveRejectAssessmentBodySchema>
export type ApproveRejectAssessmentResType = z.infer<typeof ApproveRejectAssessmentResSchema>

// ===== ASSESSMENT EVENT SCHEMAS =====

// Custom event status enum (server-defined, not stored in DB)
export const AssessmentEventStatus = z.enum(['NOT_STARTED', 'ON_GOING', 'FINISHED'])

export const AssessmentEventItemSchema = z.object({
  name: z.string().max(255),
  subjectId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  occuranceDate: z.coerce.date(),
  status: AssessmentEventStatus,
  totalTrainees: z.number().int().min(0),
  totalPassed: z.number().int().min(0),
  totalFailed: z.number().int().min(0),
  // Trainer information
  totalAvailableTrainers: z.number().int().min(0),
  availableTrainers: z.array(z.object({
    id: z.string().uuid(),
    eid: z.string(),
    fullName: z.string(),
    email: z.string(),
    roleInAssessment: z.string().nullable()
  })),
  // Additional info about the subject/course
  entityInfo: z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string(),
    type: z.enum(['subject', 'course']),
    belongToCourseName: z.string().nullable()
  }),
  // Basic template info
  templateInfo: z.object({
    id: z.string().uuid(),
    name: z.string(),
    isActive: z.boolean()
  }),
  // Trainee roster with assessment details
  traineeRoster: z.array(z.object({
    assessmentFormId: z.string().uuid(),
    assessmentFormName: z.string(),
    traineeFullName: z.string(),
    traineeEid: z.string(),
    occuranceDate: z.coerce.date(),
    status: z.nativeEnum(AssessmentStatus),
    resultScore: z.number().nullable(),
    resultText: z.nativeEnum(AssessmentResult).nullable(),
    pdfUrl: z.string().nullable()
  }))
})

export const GetAssessmentEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: AssessmentEventStatus.optional(),
  subjectId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().max(100).optional()
})

export const GetAssessmentEventsResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    events: z.array(AssessmentEventItemSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    })
  })
})

export const UpdateAssessmentEventBodySchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255, 'Name must not exceed 255 characters').optional(),
    occuranceDate: z.coerce
      .date()
      .refine((date) => date > new Date(), {
        message: 'Occurrence date must be in the future'
      })
      .optional()
  })
  .refine((data) => data.name || data.occuranceDate, {
    message: 'At least one field (name or occuranceDate) must be provided'
  })

export const UpdateAssessmentEventParamsSchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    occuranceDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid occurrence date format'
      })
      .transform((val) => new Date(val)),
    name: z.string().min(1).max(255),
    templateId: z.string().uuid()
  })
  .refine((data) => data.subjectId || data.courseId, {
    message: 'Either subjectId or courseId must be provided'
  })
  .refine((data) => !(data.subjectId && data.courseId), {
    message: 'Cannot provide both subjectId and courseId'
  })

export const UpdateAssessmentEventResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    updatedCount: z.number().int().min(0),
    eventInfo: z.object({
      name: z.string(),
      subjectId: z.string().uuid().nullable(),
      courseId: z.string().uuid().nullable(),
      occuranceDate: z.coerce.date(),
      templateId: z.string().uuid(),
      totalAssessmentForms: z.number().int().min(0)
    })
  })
})

// ===== USER ASSESSMENT EVENTS (TRAINER/TRAINEE) =====

export const GetUserAssessmentEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  courseId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  status: z.nativeEnum(AssessmentStatus).optional(),
  templateId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().max(100).optional()
})

export const GetUserAssessmentEventsResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    events: z.array(AssessmentEventItemSchema),
    totalItems: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(0)
  })
})

export type AssessmentEventItemType = z.infer<typeof AssessmentEventItemSchema>
export type GetAssessmentEventsQueryType = z.infer<typeof GetAssessmentEventsQuerySchema>
export type GetAssessmentEventsResType = z.infer<typeof GetAssessmentEventsResSchema>
export type GetUserAssessmentEventsQueryType = z.infer<typeof GetUserAssessmentEventsQuerySchema>
export type GetUserAssessmentEventsResType = z.infer<typeof GetUserAssessmentEventsResSchema>
export type UpdateAssessmentEventBodyType = z.infer<typeof UpdateAssessmentEventBodySchema>
export type UpdateAssessmentEventParamsType = z.infer<typeof UpdateAssessmentEventParamsSchema>
export type UpdateAssessmentEventResType = z.infer<typeof UpdateAssessmentEventResSchema>

// ===== DEPARTMENT ASSESSMENT EVENTS SCHEMAS =====

// Enhanced schema for department assessment events with additional statistics
export const DepartmentAssessmentEventItemSchema = z.object({
  name: z.string().max(255),
  subjectId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  occuranceDate: z.coerce.date(),
  status: AssessmentEventStatus,
  totalTrainees: z.number().int().min(0),
  // Additional statistics requested
  totalAssessments: z.number().int().min(0),
  totalReviewedForm: z.number().int().min(0),  // APPROVED or REJECTED
  totalCancelledForm: z.number().int().min(0), // CANCELLED
  totalSubmittedForm: z.number().int().min(0), // SUBMITTED
  totalTrainers: z.number().int().min(0),      // From Subject/Course_Instructor tables
  // Trainer information
  totalAvailableTrainers: z.number().int().min(0),
  availableTrainers: z.array(z.object({
    id: z.string().uuid(),
    eid: z.string(),
    fullName: z.string(),
    email: z.string(),
    roleInAssessment: z.string().nullable()
  })),
  // Additional info about the subject/course
  entityInfo: z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string(),
    type: z.enum(['subject', 'course'])
  }),
  // Basic template info
  templateInfo: z.object({
    id: z.string().uuid(),
    name: z.string(),
    isActive: z.boolean()
  })
})

export const GetDepartmentAssessmentEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  // departmentId: z.string().uuid('Department ID must be a valid UUID'),
  status: AssessmentEventStatus.optional(),
  subjectId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().max(100).optional()
})

export const GetDepartmentAssessmentEventsResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    events: z.array(DepartmentAssessmentEventItemSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    })
  })
})

export type DepartmentAssessmentEventItemType = z.infer<typeof DepartmentAssessmentEventItemSchema>
export type GetDepartmentAssessmentEventsQueryType = z.infer<typeof GetDepartmentAssessmentEventsQuerySchema>
export type GetDepartmentAssessmentEventsResType = z.infer<typeof GetDepartmentAssessmentEventsResSchema>

// ===== EVENT ASSESSMENTS SCHEMAS =====

// Query schemas for event-based assessments
export const GetEventSubjectAssessmentsBodySchema = z
  .object({
    subjectId: z.string().uuid('Subject ID must be a valid UUID'),
    templateId: z.string().uuid('Template ID must be a valid UUID'),
    occuranceDate: z.coerce.date('Occurrence date must be a valid date')
  })
  .strict()

export const GetEventSubjectAssessmentsQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(1000),
    status: z.nativeEnum(AssessmentStatus).optional(),
    search: z.string().max(255).optional()
  })
  .strict()

export type GetEventSubjectAssessmentsBodyType = z.infer<typeof GetEventSubjectAssessmentsBodySchema>
export type GetEventSubjectAssessmentsQueryType = z.infer<typeof GetEventSubjectAssessmentsQuerySchema>

export const GetEventCourseAssessmentsBodySchema = z
  .object({
    courseId: z.string().uuid('Course ID must be a valid UUID'),
    templateId: z.string().uuid('Template ID must be a valid UUID'),
    occuranceDate: z.coerce.date('Occurrence date must be a valid date')
  })
  .strict()

export const GetEventCourseAssessmentsQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(1000),
    status: z.nativeEnum(AssessmentStatus).optional(),
    search: z.string().max(255).optional()
  })
  .strict()

export type GetEventCourseAssessmentsBodyType = z.infer<typeof GetEventCourseAssessmentsBodySchema>
export type GetEventCourseAssessmentsQueryType = z.infer<typeof GetEventCourseAssessmentsQuerySchema>

// ===== ARCHIVE ASSESSMENT EVENT SCHEMAS =====

export const ArchiveAssessmentEventBodySchema = z
  .object({
    subjectId: z.string().uuid('Subject ID must be a valid UUID').optional(),
    courseId: z.string().uuid('Course ID must be a valid UUID').optional(),
    templateId: z.string().uuid('Template ID must be a valid UUID'),
    occuranceDate: z.coerce.date('Occurrence date must be a valid date')
  })
  .strict()
  .refine((data) => (data.subjectId && !data.courseId) || (!data.subjectId && data.courseId), {
    message: 'Either subjectId or courseId must be provided, but not both',
    path: ['subjectId']
  })

export const ArchiveAssessmentEventResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    eventInfo: z.object({
      name: z.string(),
      subjectId: z.string().uuid().nullable(),
      courseId: z.string().uuid().nullable(),
      templateId: z.string().uuid(),
      occuranceDate: z.coerce.date(),
      entityInfo: z.object({
        id: z.string().uuid(),
        name: z.string(),
        code: z.string(),
        type: z.enum(['subject', 'course'])
      })
    }),
    archivedCount: z.number().int().min(0),
    totalAssessments: z.number().int().min(0)
  })
})

export type ArchiveAssessmentEventBodyType = z.infer<typeof ArchiveAssessmentEventBodySchema>
export type ArchiveAssessmentEventResType = z.infer<typeof ArchiveAssessmentEventResSchema>

// Response schemas for event-based assessments (reuse existing TrainerAssessmentListItemSchema)
export const GetEventSubjectAssessmentsResSchema = z.object({
  assessments: z.array(TrainerAssessmentListItemSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  // Enhanced statistics
  numberOfTrainees: z.number().int().min(0),
  numberOfParticipatedTrainers: z.number().int().min(0),
  eventInfo: z.object({
    name: z.string(),
    occuranceDate: z.coerce.date(),
    templateId: z.string().uuid(),
    // Enhanced subject details
    subjectInfo: z.object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string(),
      description: z.string().nullable(),
      method: z.string(),
      duration: z.number().nullable(),
      type: z.string(),
      passScore: z.number().nullable(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      status: z.string(),
      course: z.object({
        id: z.string().uuid(),
        name: z.string(),
        code: z.string(),
        description: z.string().nullable(),
        maxNumTrainee: z.number().int(),
        passScore: z.number().nullable(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        status: z.string()
      })
    }),
    // Enhanced template details with content
    templateInfo: z.object({
      id: z.string().uuid(),
      name: z.string(),
      version: z.number().int(),
      status: z.string(),
      description: z.string().nullable(),
      templateContent: z.string().nullable() // The actual template document content
    })
  })
})

export type GetEventSubjectAssessmentsResType = z.infer<typeof GetEventSubjectAssessmentsResSchema>

export const GetEventCourseAssessmentsResSchema = z.object({
  assessments: z.array(TrainerAssessmentListItemSchema),
  totalItems: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  // Enhanced statistics
  numberOfTrainees: z.number().int().min(0),
  numberOfParticipatedTrainers: z.number().int().min(0),
  eventInfo: z.object({
    name: z.string(),
    occuranceDate: z.coerce.date(),
    templateId: z.string().uuid(),
    // Enhanced course details
    courseInfo: z.object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string(),
      description: z.string().nullable(),
      maxNumTrainee: z.number().int(),
      venue: z.string().nullable(),
      note: z.string().nullable(),
      passScore: z.number().nullable(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      level: z.string(),
      status: z.string(),
      department: z.object({
        id: z.string().uuid(),
        name: z.string(),
        code: z.string()
      })
    }),
    // Enhanced template details with content
    templateInfo: z.object({
      id: z.string().uuid(),
      name: z.string(),
      version: z.number().int(),
      status: z.string(),
      description: z.string().nullable(),
      templateContent: z.string().nullable() // The actual template document content
    })
  })
})

export type GetEventCourseAssessmentsResType = z.infer<typeof GetEventCourseAssessmentsResSchema>

// ===== DOCX TEMPLATE RENDERING SCHEMAS =====

export const RenderDocxTemplateBodySchema = z.object({
  templateUrl: z.string().url('Must be a valid URL to the DOCX template'),
  data: z.record(z.string(), z.any())
})

export const RenderDocxTemplateResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    filename: z.string(),
    contentType: z.string(),
    buffer: z.string() // Base64 encoded DOCX file
  })
})

export type RenderDocxTemplateBodyType = z.infer<typeof RenderDocxTemplateBodySchema>
export type RenderDocxTemplateResType = z.infer<typeof RenderDocxTemplateResSchema>
