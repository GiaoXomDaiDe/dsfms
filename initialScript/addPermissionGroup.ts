import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const rawData = {
  'permissions-by-feature-group': [
    {
      'feature-group': 'User & Access Management',
      permissions: [
        { 'permission-id': 'PERM-01', 'permission-name': 'View All Users' },
        { 'permission-id': 'PERM-02', 'permission-name': 'Create User Account' },
        { 'permission-id': 'PERM-03', 'permission-name': 'Bulk Import User Accounts' },
        { 'permission-id': 'PERM-04', 'permission-name': 'Update User' },
        { 'permission-id': 'PERM-05', 'permission-name': 'Disable/Enable User' },
        { 'permission-id': 'PERM-06', 'permission-name': 'View All Roles' },
        { 'permission-id': 'PERM-07', 'permission-name': 'Create Role' },
        { 'permission-id': 'PERM-08', 'permission-name': 'Update Role' },
        { 'permission-id': 'PERM-09', 'permission-name': 'Disable/Enable Role' },
        { 'permission-id': 'PERM-10', 'permission-name': 'View Profile' },
        { 'permission-id': 'PERM-11', 'permission-name': 'Configure Signature' },
        { 'permission-id': 'PERM-12', 'permission-name': 'Update Profile' }
      ]
    },
    {
      'feature-group': 'Academic Management',
      permissions: [
        { 'permission-id': 'PERM-13', 'permission-name': 'View All Departments' },
        { 'permission-id': 'PERM-14', 'permission-name': 'Create Department' },
        { 'permission-id': 'PERM-15', 'permission-name': 'Update Department' },
        { 'permission-id': 'PERM-16', 'permission-name': 'Disable/Enable Department' },
        { 'permission-id': 'PERM-17', 'permission-name': 'View My Department Detail' },
        { 'permission-id': 'PERM-18', 'permission-name': 'View All Courses' },
        { 'permission-id': 'PERM-19', 'permission-name': 'Create Course' },
        { 'permission-id': 'PERM-20', 'permission-name': 'Update Course' },
        { 'permission-id': 'PERM-21', 'permission-name': 'Archive Course' },
        { 'permission-id': 'PERM-22', 'permission-name': 'View My List Instructed Course' },
        { 'permission-id': 'PERM-23', 'permission-name': 'View List Course (for trainer)' },
        { 'permission-id': 'PERM-24', 'permission-name': 'View All Subjects' },
        { 'permission-id': 'PERM-25', 'permission-name': 'Bulk Add Subjects' },
        { 'permission-id': 'PERM-26', 'permission-name': 'Add Single Subject' },
        { 'permission-id': 'PERM-27', 'permission-name': 'Update Subject' },
        { 'permission-id': 'PERM-28', 'permission-name': 'Disable Subject' },
        { 'permission-id': 'PERM-29', 'permission-name': 'View All Enrollments' },
        { 'permission-id': 'PERM-30', 'permission-name': 'Enroll Trainee' },
        { 'permission-id': 'PERM-31', 'permission-name': 'Remove Trainee from Enrollment' },
        { 'permission-id': 'PERM-32', 'permission-name': 'View My Enrolled Course List' }
      ]
    },
    {
      'feature-group': 'Template & Form Management',
      permissions: [
        { 'permission-id': 'PERM-33', 'permission-name': 'View All Template' },
        { 'permission-id': 'PERM-34', 'permission-name': 'Create Template' },
        { 'permission-id': 'PERM-35', 'permission-name': 'Edit Draft Template' },
        { 'permission-id': 'PERM-36', 'permission-name': 'Submit Template' },
        { 'permission-id': 'PERM-37', 'permission-name': 'Delete Draft Template' },
        { 'permission-id': 'PERM-38', 'permission-name': 'Update Template Version' },
        { 'permission-id': 'PERM-39', 'permission-name': 'Disable/Enable Template' },
        { 'permission-id': 'PERM-40', 'permission-name': 'Approve/Deny Template' },
        { 'permission-id': 'PERM-41', 'permission-name': 'Download Template As PDF' },
        { 'permission-id': 'PERM-42', 'permission-name': 'View All Assessment Forms' },
        { 'permission-id': 'PERM-43', 'permission-name': 'Create Assessment Form' },
        { 'permission-id': 'PERM-44', 'permission-name': 'Update Assessment Form' },
        { 'permission-id': 'PERM-45', 'permission-name': 'Archive Assessment Form' }
      ]
    },
    {
      'feature-group': 'Assessment Process',
      permissions: [
        { 'permission-id': 'PERM-46', 'permission-name': 'View All Assessments' },
        { 'permission-id': 'PERM-47', 'permission-name': 'Fill and Save Assessment Draft' },
        { 'permission-id': 'PERM-48', 'permission-name': 'Sign Confirm Assessment' },
        { 'permission-id': 'PERM-49', 'permission-name': 'Submit Assessment for Approval' },
        { 'permission-id': 'PERM-50', 'permission-name': 'View My List Upcoming Assessment' },
        { 'permission-id': 'PERM-51', 'permission-name': 'View My Assessment' },
        { 'permission-id': 'PERM-52', 'permission-name': 'View All Assessment Requests' },
        { 'permission-id': 'PERM-53', 'permission-name': 'Approve/Deny Submitted Assessment' },
        { 'permission-id': 'PERM-54', 'permission-name': 'View All Assessment Results' }
      ]
    },
    {
      'feature-group': 'Reporting & Analytics',
      permissions: [
        { 'permission-id': 'PERM-55', 'permission-name': 'View All Incident/Feedback Report' },
        { 'permission-id': 'PERM-56', 'permission-name': 'Submit Incident/Feedback Report' },
        { 'permission-id': 'PERM-57', 'permission-name': 'Cancel Incident/Feedback Report' },
        { 'permission-id': 'PERM-58', 'permission-name': 'Review Incident/Feedback Report' },
        { 'permission-id': 'PERM-59', 'permission-name': 'View My Issue List' },
        { 'permission-id': 'PERM-60', 'permission-name': 'View Analytics Dashboard' }
      ]
    },
    {
      'feature-group': 'System Management',
      permissions: [
        { 'permission-id': 'PERM-61', 'permission-name': 'View All Global Fields' },
        { 'permission-id': 'PERM-62', 'permission-name': 'Configure Global Fields' },
        { 'permission-id': 'PERM-63', 'permission-name': 'Update Global Field' },
        { 'permission-id': 'PERM-64', 'permission-name': 'Disable/Enable Field' }
      ]
    }
  ]
} as const

async function main() {
  const groups = rawData['permissions-by-feature-group']

  for (const fg of groups) {
    const featureGroupName = fg['feature-group']

    for (const perm of fg.permissions) {
      const permissionId = perm['permission-id'] // PERM-xx
      const permissionName = perm['permission-name'] // text

      // groupName phải unique → encode: "<feature-group> - <permission-id>"
      const groupName = `${featureGroupName} - ${permissionId}`

      await prisma.permissionGroup.upsert({
        where: { groupName },
        update: {
          name: permissionName,
          permissionGroupCode: permissionId
        },
        create: {
          groupName,
          name: permissionName,
          permissionGroupCode: permissionId
        }
      })
    }
  }

  console.log('✅ Seed PermissionGroup từ JSON FE thành công (không map EndpointPermission).')
}

main()
  .catch((e) => {
    console.error('❌ Seed PermissionGroup thất bại:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
