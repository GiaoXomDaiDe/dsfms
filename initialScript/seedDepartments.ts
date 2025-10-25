import { DepartmentType } from '~/routes/department/department.model'
import { PrismaService } from '~/shared/services/prisma.service'

const prismaService = new PrismaService()

// Departments data from requirements
const SYSTEM_DEPARTMENTS = [
  {
    code: 'CCT',
    name: 'Cabin Crew Training Department',
    description:
      'Responsible for the training and development of airline cabin crew. Covers all essential onboard skills: safety procedures, emergency handling, first aid, and customer service.'
  },
  {
    code: 'FCTD',
    name: 'Flight Crew Training Department',
    description:
      'Provides training for pilots, including captains and first officers. Includes simulator training (SIM), aircraft type rating, and recurrent courses to maintain and enhance flying skills.'
  },
  {
    code: 'GAT',
    name: 'Ground Affairs Training Department',
    description:
      'Responsible for training staff across ground service functions. Covers roles such as check-in agents, gate staff, and baggage service personnel.'
  },
  {
    code: 'GOT',
    name: 'Ground Operations Training Department',
    description:
      'A more specialized branch of ground training focused on ramp operations. Trains staff working on the apron: marshalling aircraft to stands, operating stairs and baggage vehicles, and loading/unloading procedures.'
  },
  {
    code: 'TAMT',
    name: 'Technical & Aircraft Maintenance Training Department',
    description:
      'Trains engineers, mechanics, and technical personnel. Focuses on maintenance, repair, and overhaul to ensure aircraft remain airworthy and compliant with strict technical standards.'
  },
  {
    code: 'SQA',
    name: 'Safety & Quality Assurance Department',
    description:
      'An independent oversight unit ensuring safety and quality compliance. Audits and evaluates all training programs (e.g., CCT, FCTD, GOT) for compliance with aviation authority and airline standards; reviews score sheets and grading processes to ensure output quality.'
  }
]

async function ensureDepartment(departmentData: (typeof SYSTEM_DEPARTMENTS)[0]) {
  try {
    // Check if department exists by code (unique identifier)
    const existingDepartment = await prismaService.department.findFirst({
      where: {
        code: departmentData.code,
        deletedAt: null
      }
    })

    if (existingDepartment) {
      // Update department if name or description changed
      const needsUpdate =
        existingDepartment.name !== departmentData.name || existingDepartment.description !== departmentData.description

      if (needsUpdate) {
        const updatedDepartment = await prismaService.department.update({
          where: { id: existingDepartment.id },
          data: {
            name: departmentData.name,
            description: departmentData.description
          }
        })
        console.log(`[UPDATE] Department updated: ${departmentData.code} - ${departmentData.name}`)
        return updatedDepartment
      }

      console.log(`[SKIP] Department already exists: ${departmentData.code} - ${departmentData.name}`)
      return existingDepartment
    }

    // Create new department
    const newDepartment = await prismaService.department.create({
      data: {
        code: departmentData.code,
        name: departmentData.name,
        description: departmentData.description,
        isActive: true
      }
    })
    console.log(`[CREATE] Department created: ${departmentData.code} - ${departmentData.name}`)
    return newDepartment
  } catch (error) {
    console.error(`[ERROR] Failed to process department ${departmentData.code}:`, error)
    throw error
  }
}

const main = async () => {
  console.log('[INFO] Starting department initialization...\n')

  try {
    // Step 1: Ensure all departments exist and are up-to-date
    const departments: DepartmentType[] = []
    for (const departmentData of SYSTEM_DEPARTMENTS) {
      const department = await ensureDepartment(departmentData)
      departments.push(department)
    }

    // Step 2: Summary report
    console.log('\n[SUMMARY] Department Overview:')
    console.log('='.repeat(80))

    for (const department of departments) {
      // Count trainers in each department
      const trainerCount = await prismaService.user.count({
        where: {
          departmentId: department.id,
          deletedAt: null,
          role: {
            name: 'TRAINER'
          }
        }
      })

      // Count courses in each department (if applicable)
      let courseCount = 0
      try {
        courseCount = await prismaService.course.count({
          where: {
            departmentId: department.id,
            deletedAt: null
          }
        })
      } catch (error) {
        // Course table might not exist yet, ignore error
        courseCount = 0
      }

      console.log(
        `${department.code.padEnd(6)} | ${department.name.padEnd(45)} | ${trainerCount} trainers | ${courseCount} courses`
      )
    }

    // Step 3: Check for department heads
    console.log('\n[INFO] Department Head Status:')
    console.log('='.repeat(80))

    for (const department of departments) {
      if (department.headUserId) {
        const headUser = await prismaService.user.findUnique({
          where: { id: department.headUserId },
          select: {
            firstName: true,
            lastName: true,
            email: true,
            eid: true
          }
        })
        console.log(
          `${department.code.padEnd(6)} | Head: ${headUser?.firstName} ${headUser?.lastName} (${headUser?.eid})`
        )
      } else {
        console.log(`${department.code.padEnd(6)} | Head: Not assigned`)
      }
    }

    return {
      departments,
      summary: {
        totalDepartments: departments.length,
        departmentsWithHeads: departments.filter((d) => d.headUserId).length,
        departmentsWithoutHeads: departments.filter((d) => !d.headUserId).length
      }
    }
  } catch (error) {
    console.error('[ERROR] Fatal error during department initialization:', error)
    throw error
  }
}

main()
  .then(({ departments, summary }) => {
    console.log('\n[COMPLETE] Department Initialization Summary:')
    console.log(`[INFO] Total departments: ${summary.totalDepartments}`)
    console.log(`[INFO] Departments with heads: ${summary.departmentsWithHeads}`)
    console.log(`[INFO] Departments without heads: ${summary.departmentsWithoutHeads}`)
    console.log('\n[SUCCESS] Department initialization completed successfully!')
  })
  .catch((error) => {
    console.error('[ERROR] Department initialization failed:', error)
    process.exit(1)
  })
  .finally(() => {
    prismaService.$disconnect()
  })
