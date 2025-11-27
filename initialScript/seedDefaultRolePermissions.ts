import { RoleName, type RoleNameType } from '~/shared/constants/auth.constant'
import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'
import { PrismaService } from '~/shared/services/prisma.service'

const prisma = new PrismaService()
const TARGET_ROLE_NAMES: RoleNameType[] = [
  RoleName.ADMINISTRATOR,
  RoleName.DEPARTMENT_HEAD,
  RoleName.TRAINEE,
  RoleName.SQA_AUDITOR,
  RoleName.ACADEMIC_DEPARTMENT,
  RoleName.TRAINER
]

async function getDefaultPermissionIds(): Promise<string[]> {
  const permissions = await prisma.endpointPermission.findMany({
    where: {
      name: {
        in: DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES as unknown as string[]
      },
      deletedAt: null,
      isActive: true
    },
    select: {
      id: true,
      name: true
    }
  })

  const foundNames = new Set(permissions.map((permission) => permission.name))
  const missingNames = DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES.filter((name) => !foundNames.has(name))

  if (missingNames.length > 0) {
    throw new Error(`Missing default permissions: ${missingNames.join(', ')}`)
  }

  return permissions.map((permission) => permission.id)
}

async function upsertRolePermissions(roleName: RoleNameType, permissionIds: string[]): Promise<void> {
  const role = await prisma.role.findFirst({
    where: {
      name: roleName,
      deletedAt: null,
      isActive: true
    },
    include: {
      permissions: {
        select: {
          id: true
        }
      }
    }
  })

  if (!role) {
    console.warn(`Role '${roleName}' not found or inactive. Skipping.`)
    return
  }

  const existingPermissionIds = new Set(role.permissions.map((permission) => permission.id))
  const missingPermissionIds = permissionIds.filter((permissionId) => !existingPermissionIds.has(permissionId))
  const missingCount = missingPermissionIds.length
  const totalDefault = permissionIds.length

  console.log(
    `[${roleName}] Default permission coverage: ${totalDefault - missingCount}/${totalDefault} present. Missing ${missingCount}.`
  )

  if (missingPermissionIds.length === 0) {
    console.log(`Role '${roleName}' already has all default permissions.`)
    return
  }

  await prisma.role.update({
    where: {
      id: role.id
    },
    data: {
      permissions: {
        connect: missingPermissionIds.map((permissionId) => ({ id: permissionId }))
      }
    }
  })

  console.log(
    `Added ${missingPermissionIds.length} default permission(s) to role '${roleName}'. (Total permissions: ${existingPermissionIds.size + missingPermissionIds.length})`
  )
}

export async function seedData(): Promise<void> {
  console.log('Seeding default endpoint permissions for base roles...')

  try {
    const permissionIds = await getDefaultPermissionIds()
    console.log(`Total default permissions to enforce: ${permissionIds.length}`)

    for (const roleName of TARGET_ROLE_NAMES) {
      await upsertRolePermissions(roleName, permissionIds)
    }

    console.log('Default permissions seeding completed.')
  } catch (error) {
    console.error('Failed to seed default permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  seedData().catch((error) => {
    console.error('Seeder encountered an unrecoverable error.', error)
    process.exit(1)
  })
}
