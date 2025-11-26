import envConfig from '~/shared/config'
import { GenderStatus, RoleName } from '~/shared/constants/auth.constant'
import { RoleType } from '~/shared/models/shared-role.model'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'
import { PrismaService } from '~/shared/services/prisma.service'

const prismaService = new PrismaService()
const hashingService = new HashingService()
const eidService = new EidService(prismaService)

const SYSTEM_ROLES = [
  { name: RoleName.ADMINISTRATOR, description: 'Administrator role' },
  { name: RoleName.TRAINEE, description: 'Trainee role' },
  { name: RoleName.TRAINER, description: 'Trainer role' },
  { name: RoleName.DEPARTMENT_HEAD, description: 'Department Head role' },
  { name: RoleName.SQA_AUDITOR, description: 'SQA Auditor role' },
  { name: RoleName.ACADEMIC_DEPARTMENT, description: 'Academic Department role' }
]
const DEFAULT_USERS = [
  {
    roleName: RoleName.ADMINISTRATOR,
    email: envConfig.ADMIN_EMAIL,
    firstName: envConfig.ADMIN_FIRST_NAME,
    middleName: envConfig.ADMIN_MIDDLE_NAME,
    lastName: envConfig.ADMIN_LAST_NAME,
    password: envConfig.ADMIN_PASSWORD,
    gender: GenderStatus.MALE
  },
  {
    roleName: RoleName.DEPARTMENT_HEAD,
    email: envConfig.DEPARTMENT_HEAD_EMAIL,
    firstName: envConfig.DEPARTMENT_HEAD_FIRST_NAME,
    middleName: envConfig.DEPARTMENT_HEAD_MIDDLE_NAME,
    lastName: envConfig.DEPARTMENT_HEAD_LAST_NAME,
    password: envConfig.DEPARTMENT_HEAD_PASSWORD,
    gender: GenderStatus.MALE
  },
  {
    roleName: RoleName.ACADEMIC_DEPARTMENT,
    email: envConfig.ACADEMIC_DEPARTMENT_EMAIL,
    firstName: envConfig.ACADEMIC_DEPARTMENT_FIRST_NAME,
    middleName: envConfig.ACADEMIC_DEPARTMENT_MIDDLE_NAME,
    lastName: envConfig.ACADEMIC_DEPARTMENT_LAST_NAME,
    password: envConfig.ACADEMIC_DEPARTMENT_PASSWORD,
    gender: GenderStatus.MALE
  }
]

async function ensureRole(roleData: { name: string; description: string }) {
  try {
    // Check if role exists
    const existingRole = await prismaService.role.findFirst({
      where: {
        name: roleData.name,
        deletedAt: null
      }
    })

    if (existingRole) {
      // Update description if changed
      if (existingRole.description !== roleData.description) {
        const updatedRole = await prismaService.role.update({
          where: { id: existingRole.id },
          data: { description: roleData.description }
        })
        console.log(`Updated role: ${roleData.name}`)
        return updatedRole
      }
      console.log(`Role already exists: ${roleData.name}`)
      return existingRole
    }

    // Create new role
    const newRole = await prismaService.role.create({
      data: roleData
    })
    console.log(`Created new role: ${roleData.name}`)
    return newRole
  } catch (error) {
    console.error(`Error processing role ${roleData.name}:`, error)
    throw error
  }
}

async function ensureUser(userData: (typeof DEFAULT_USERS)[0], roleId: string) {
  try {
    // Check if user exists by email
    const existingUser = await prismaService.user.findFirst({
      where: {
        email: userData.email,
        deletedAt: null
      }
    })

    if (existingUser) {
      // Update user if needed (e.g., role changed)
      if (existingUser.roleId !== roleId) {
        const updatedUser = await prismaService.user.update({
          where: { id: existingUser.id },
          data: { roleId }
        })
        console.log(`Updated user role: ${userData.email}`)
        return updatedUser
      }
      console.log(`User already exists: ${userData.email}`)
      return existingUser
    }

    // Generate EID for new user
    const eid = await eidService.generateEid({ roleName: userData.roleName })
    const hashedPassword = await hashingService.hashPassword(userData.password)

    // Create new user
    const newUser = await prismaService.user.create({
      data: {
        email: userData.email,
        eid: eid as string,
        firstName: userData.firstName,
        middleName: userData.middleName,
        lastName: userData.lastName,
        gender: userData.gender,
        passwordHash: hashedPassword,
        roleId
      }
    })
    console.log(`Created new user: ${userData.email} (${userData.roleName})`)
    return newUser
  } catch (error) {
    console.error(`Error processing user ${userData.email}:`, error)
    throw error
  }
}
const main = async () => {
  console.log('Starting role and user initialization/update...\n')

  try {
    // Step 1: Ensure all roles exist and are up-to-date
    const roles: RoleType[] = []
    for (const roleData of SYSTEM_ROLES) {
      const role = await ensureRole(roleData)
      roles.push(role)
    }

    // Step 2: Ensure default users exist
    const users = []
    for (const userData of DEFAULT_USERS) {
      const role = roles.find((r) => r.name === userData.roleName)
      if (!role) {
        console.warn(`Role not found for user: ${userData.email}`)
        continue
      }
      const user = await ensureUser(userData, role.id)
      users.push(user)
    }

    // Step 3: Summary report
    console.log('Roles:')
    for (const role of roles) {
      const userCount = await prismaService.user.count({
        where: { roleId: role.id, deletedAt: null }
      })
      console.log(`  - ${role.name}: ${userCount} users`)
    }

    // Optional: Show base roles that shouldn't be deleted
    const baseRoles = await prismaService.role.findMany({
      where: {
        name: {
          in: [RoleName.ADMINISTRATOR, RoleName.TRAINEE, RoleName.TRAINER, RoleName.DEPARTMENT_HEAD]
        },
        deletedAt: null
      }
    })

    return {
      roles,
      users,
      summary: {
        totalRoles: roles.length,
        totalDefaultUsers: users.length
      }
    }
  } catch (error) {
    console.error('Fatal error during initialization:', error)
    throw error
  }
}

main()
  .then(({ roles, users, summary }) => {
    console.log('Roles created:', summary.totalRoles)
    console.log('Default users created:', summary.totalDefaultUsers)
    console.log('Initialization/update completed successfully.')
    console.log(roles, users)
  })
  .catch((error) => {
    console.error('Error occurred while creating admin user and roles:', error)
  })
