# Assessment Events API Test Guide

## 1. Get Assessment Events API
**Endpoint:** `GET /assessments/events`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): AssessmentStatus enum value
- `subjectId` (optional): UUID of subject
- `courseId` (optional): UUID of course
- `templateId` (optional): UUID of template
- `fromDate` (optional): Start date filter (ISO date)
- `toDate` (optional): End date filter (ISO date)
- `search` (optional): Search term for assessment name

**Example Request:**
```bash
GET /assessments/events?page=1&limit=10&status=NOT_STARTED
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Assessment events retrieved successfully",
  "data": {
    "events": [
      {
        "name": "Midterm Assessment",
        "subjectId": "uuid-here",
        "courseId": null,
        "occuranceDate": "2024-12-15T00:00:00.000Z",
        "status": "NOT_STARTED",
        "totalTrainees": 15,
        "entityInfo": {
          "id": "uuid-here",
          "name": "Advanced Programming",
          "code": "AP101",
          "type": "subject"
        },
        "templateInfo": {
          "id": "uuid-here",
          "name": "Standard Assessment Template",
          "isActive": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

## 2. Update Assessment Event API
**Endpoint:** `PUT /assessments/events/update`

**Query Parameters (Required):**
- `name`: Current assessment name (string)
- `occuranceDate`: Current occurrence date (ISO date string)
- `templateId`: Assessment template UUID (string)
- Either `subjectId` (UUID) OR `courseId` (UUID), not both

**Body (Optional - at least one field required):**
- `name`: New assessment name
- `occuranceDate`: New occurrence date (must be in the future)

**Example Request:**
```bash
PUT /assessments/events/update?subjectId=uuid-here&occuranceDate=2024-12-15&name=Midterm Assessment&templateId=template-uuid-here

Body:
{
  "name": "Updated Midterm Assessment",
  "occuranceDate": "2024-12-20T00:00:00.000Z"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully updated 15 assessment form(s)",
  "data": {
    "updatedCount": 15,
    "eventInfo": {
      "name": "Updated Midterm Assessment",
      "subjectId": "uuid-here",
      "courseId": null,
      "occuranceDate": "2024-12-20T00:00:00.000Z",
      "templateId": "template-uuid-here",
      "totalAssessmentForms": 15
    }
  }
}
```

## Business Logic Rules

### Get Events API:
1. Groups assessment forms by name, subjectId/courseId, occuranceDate, and templateId
2. Returns count of trainees per event (totalTrainees)
3. Provides subject/course information and template details
4. Supports pagination and filtering
5. Authorization handled by RBAC system

### Update Event API:
1. Only works on assessment forms with status NOT_STARTED
2. Can only update if occurrence date hasn't passed
3. New occurrence date must be in the future
4. Updates ALL assessment forms matching the event criteria (name + subjectId/courseId + occuranceDate + templateId)
5. Authorization handled by RBAC system

### Automatic Status Update (Background Process):
- When occurrence date arrives, assessment forms automatically change from NOT_STARTED to ON_GOING
- This should be handled by a scheduled job or background process

## Error Scenarios:
1. **404**: No assessment forms found matching criteria
2. **400**: Invalid occurrence date (in the past)
3. **403**: Insufficient permissions 
4. **400**: Assessment forms not in NOT_STARTED status
5. **400**: Occurrence date has already passed

## Security & Authorization:
- All endpoints require authentication
- Authorization handled by RBAC (Role-Based Access Control) system
- Business logic focuses only on data operations and validation