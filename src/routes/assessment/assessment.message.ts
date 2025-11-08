// ===== SUCCESS MESSAGES =====

export const ASSESSMENT_MESSAGES = {
  // General success messages
  ASSESSMENT_CREATED: (count: number) => `Successfully created ${count} assessment(s)`,
  ASSESSMENT_UPDATED: 'Assessment updated successfully',
  ASSESSMENT_DELETED: 'Assessment deleted successfully',
  
  // Bulk operations
  BULK_ASSESSMENT_CREATED: (count: number, entityType: string, entityName: string) => 
    `Successfully created ${count} assessment(s) for ${entityType}: ${entityName}`,
  
  // Section operations
  ASSESSMENT_VALUES_SAVED: 'Assessment values saved successfully',
  ASSESSMENT_VALUES_UPDATED: 'Assessment values updated successfully',
  ASSESSMENT_VALUES_UPDATED_WITH_STATUS_CHANGE: 'Assessment values updated successfully and assessment status changed to READY_TO_SUBMIT',
  ASSESSMENT_SECTION_RETRIEVED: 'Assessment sections retrieved successfully',
  ASSESSMENT_SECTION_FIELDS_RETRIEVED: 'Assessment section fields retrieved successfully',
  
  // Status changes
  TRAINEE_LOCK_TOGGLED: (isLocked: boolean) => 
    `Trainee lock ${isLocked ? 'enabled' : 'disabled'} successfully`,
  ASSESSMENT_SUBMITTED: 'Assessment submitted successfully',
  ASSESSMENT_PARTICIPATION_CONFIRMED: 'Assessment participation confirmed successfully',
  
  // Status transitions
  STATUS_CHANGED_TO_DRAFT: 'Assessment status changed to DRAFT',
  STATUS_CHANGED_TO_SIGNATURE_PENDING: 'Assessment status changed to SIGNATURE_PENDING',
  STATUS_CHANGED_TO_READY_TO_SUBMIT: 'Assessment status changed to READY_TO_SUBMIT',
  STATUS_CHANGED_TO_SUBMITTED: 'Assessment status changed to SUBMITTED',
  
  // Retrieval operations
  ASSESSMENTS_RETRIEVED: 'Assessments retrieved successfully',
  ASSESSMENT_DETAIL_RETRIEVED: 'Assessment details retrieved successfully',
  SUBJECT_ASSESSMENTS_RETRIEVED: 'Subject assessments retrieved successfully',
  COURSE_ASSESSMENTS_RETRIEVED: 'Course assessments retrieved successfully'
} as const

// ===== INFORMATIONAL MESSAGES =====

export const ASSESSMENT_INFO_MESSAGES = {
  NO_SECTIONS_TO_ASSESS: 'No sections available for assessment at this time',
  ASSESSMENT_LOCKED: 'Assessment is currently locked for trainee',
  ASSESSMENT_UNLOCKED: 'Assessment is available for trainee to fill',
  ALL_SECTIONS_COMPLETED: 'All required sections have been completed',
  PARTIAL_SECTIONS_COMPLETED: 'Some sections are still pending completion'
} as const

// ===== WARNING MESSAGES =====

export const ASSESSMENT_WARNING_MESSAGES = {
  SKIPPED_TRAINEES_EXIST: 'Some trainees were skipped during bulk assessment creation',
  DUPLICATE_ASSESSMENTS_FOUND: 'Some trainees already have assessments for this date',
  EXCLUDED_TRAINEES: 'Some trainees were manually excluded from assessment creation'
} as const