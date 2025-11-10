# Template Review API Documentation

## API Endpoint
**PATCH** `/templates/:id/review`

## Purpose
Review a template that was created with status "PENDING" and change it to either "PUBLISHED" (approved) or "REJECTED". Automatically sends email notifications to the template creator about the review decision.

## Authorization
- Handled by RBAC system
- Typically requires admin or reviewer role permissions

## Request Parameters

### Path Parameters
- `id` (string, UUID): The ID of the template to review

### Request Body
```json
{
  "action": "PUBLISHED" | "REJECTED",
  "comment": "string (optional for PUBLISHED, required for REJECTED)"
}
```

**Validation Rules:**
- `action`: Must be either "PUBLISHED" or "REJECTED"
- `comment`: 
  - Optional for "PUBLISHED" action
  - Required for "REJECTED" action
  - Maximum 1000 characters
  - Only used in email notification, not stored in database

## Response Format
```json
{
  "success": true,
  "message": "Template published successfully and notification email sent",
  "data": {
    "templateId": "uuid-string",
    "templateName": "Assessment Template Name",
    "status": "PUBLISHED",
    "previousStatus": "PENDING",
    "reviewedBy": "reviewer-uuid",
    "reviewedAt": "2024-12-20T10:30:00.000Z",
    "comment": "Optional reviewer comment",
    "emailSent": true
  }
}
```

## Example Requests

### 1. Approve Template
```bash
PATCH /templates/12345678-1234-1234-1234-123456789012/review

Body:
{
  "action": "PUBLISHED"
}
```

### 2. Reject Template
```bash
PATCH /templates/12345678-1234-1234-1234-123456789012/review

Body:
{
  "action": "REJECTED",
  "comment": "The template structure needs improvement. Please add more detailed field descriptions and ensure all sections have proper validation rules."
}
```

## Email Notifications

### Approved Template Email
- **Subject:** `Template Approved - [Template Name]`
- **Content:** Congratulatory message with template details
- **Template:** Uses `approved-template.txt`
- **Placeholders:**
  - `[CREATOR_NAME]`: Template creator's name
  - `[TEMPLATE_NAME]`: Template name
  - `[TEMPLATE_VERSION]`: Template version number
  - `[DEPARTMENT_NAME]`: Department name
  - `[CREATION_DATE]`: Template creation date
  - `[REVIEWER_NAME]`: Reviewer's name
  - `[REVIEW_DATE]`: Review date

### Rejected Template Email
- **Subject:** `Template Rejected - [Template Name]`
- **Content:** Rejection notice with feedback
- **Template:** Uses `rejected-template.txt`
- **Placeholders:** Same as approved email plus:
  - `[REJECTION_COMMENT]`: Reviewer's comment

## Business Logic

### Prerequisites
1. Template must exist
2. Template status must be "PENDING"
3. Template must have creator information
4. Reviewer must be a valid user

### Process Flow
1. Validate template exists and is in PENDING status
2. Get template creator and reviewer information
3. Update template status in database
4. Set reviewedBy and reviewedAt fields
5. Send appropriate email notification
6. Return response with operation status

### Status Transitions
- `PENDING` → `PUBLISHED` (Approval)
- `PENDING` → `REJECTED` (Rejection)

### Email Handling
- Email failure does not fail the entire operation
- Response indicates whether email was sent successfully
- Uses same logo URL as other system emails

## Error Scenarios

### 404 - Template Not Found
```json
{
  "error": "Template not found"
}
```

### 400 - Invalid Status
```json
{
  "error": "Template must be in PENDING status to be reviewed"
}
```

### 400 - Missing Comment for Rejection
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "comment",
      "message": "Comment is required for rejection"
    }
  ]
}
```

### 400 - Comment Too Long
```json
{
  "message": "Validation failed", 
  "errors": [
    {
      "field": "comment",
      "message": "Comment must not exceed 1000 characters"
    }
  ]
}
```

## Integration Notes

1. **Email Templates:** Located in `src/shared/email-template/`
   - `approved-template.txt` - For approvals
   - `rejected-template.txt` - For rejections

2. **Database Updates:** 
   - Updates `status`, `reviewedByUserId`, and `reviewedAt` fields
   - No comment field stored in database (comment only used for email)

3. **RBAC Integration:**
   - Authorization handled by RBAC decorators
   - No manual permission checking in business logic

4. **Email Service:**
   - Uses NodemailerService
   - Graceful failure handling
   - Professional HTML templates with consistent branding

## Usage Scenarios

1. **Administrative Review Process:** Admins review templates submitted by users
2. **Quality Control:** Department heads review templates before publication  
3. **Template Lifecycle Management:** Systematic approval workflow for template publishing
4. **Communication:** Automated notifications keep creators informed of review status

This API complements the existing template management system by adding a formal review process with automated notifications.