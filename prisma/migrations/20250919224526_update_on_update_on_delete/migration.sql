-- DropForeignKey
ALTER TABLE "DSFMS"."Department" DROP CONSTRAINT "Department_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Department" DROP CONSTRAINT "Department_headUserId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Department" DROP CONSTRAINT "Department_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Permission" DROP CONSTRAINT "Permission_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Permission" DROP CONSTRAINT "Permission_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Role" DROP CONSTRAINT "Role_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Role" DROP CONSTRAINT "Role_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" DROP CONSTRAINT "Trainee_Profile_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" DROP CONSTRAINT "Trainee_Profile_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" DROP CONSTRAINT "Trainee_Profile_userId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" DROP CONSTRAINT "Trainer_Profile_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" DROP CONSTRAINT "Trainer_Profile_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" DROP CONSTRAINT "Trainer_Profile_userId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."User" DROP CONSTRAINT "User_createdById_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."User" DROP CONSTRAINT "User_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."User" DROP CONSTRAINT "User_roleId_fkey";

-- DropForeignKey
ALTER TABLE "DSFMS"."User" DROP CONSTRAINT "User_updatedById_fkey";

-- AlterTable
ALTER TABLE "DSFMS"."Department" ADD COLUMN     "deletedById" UUID;

-- AlterTable
ALTER TABLE "DSFMS"."Permission" ADD COLUMN     "deletedById" UUID;

-- AlterTable
ALTER TABLE "DSFMS"."Role" ADD COLUMN     "deletedById" UUID;

-- AlterTable
ALTER TABLE "DSFMS"."Trainee_Profile" ADD COLUMN     "deletedById" UUID;

-- AlterTable
ALTER TABLE "DSFMS"."Trainer_Profile" ADD COLUMN     "deletedById" UUID;

-- AlterTable
ALTER TABLE "DSFMS"."User" ADD COLUMN     "deletedById" UUID;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "DSFMS"."Role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DSFMS"."Department"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Role" ADD CONSTRAINT "Role_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Role" ADD CONSTRAINT "Role_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Role" ADD CONSTRAINT "Role_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Permission" ADD CONSTRAINT "Permission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Permission" ADD CONSTRAINT "Permission_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Permission" ADD CONSTRAINT "Permission_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DSFMS"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DSFMS"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
