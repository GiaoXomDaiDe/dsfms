CREATE SCHEMA IF NOT EXISTS "DSFMS";
SET search_path = "DSFMS", public;

-- extensions ở schema public (chuẩn RDS)
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "DSFMS"."UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DSFMS"."GenderStatus" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "DSFMS"."HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateTable
CREATE TABLE "DSFMS"."User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eid" VARCHAR(8) NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "address" TEXT,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "DSFMS"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "signatureImageUrl" TEXT,
    "roleId" UUID NOT NULL,
    "gender" "DSFMS"."GenderStatus" NOT NULL,
    "avatarUrl" TEXT,
    "phoneNumber" VARCHAR(20),
    "departmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "method" "DSFMS"."HttpMethod" NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSFMS"."Trainer_Profile" (
    "userId" UUID NOT NULL,
    "specialization" TEXT NOT NULL,
    "certificationNumber" TEXT,
    "yearsOfExp" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Trainer_Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DSFMS"."Trainee_Profile" (
    "userId" UUID NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "enrollmentDate" TIMESTAMP(3) NOT NULL,
    "trainingBatch" TEXT NOT NULL,
    "passportNo" TEXT,
    "nation" TEXT NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Trainee_Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DSFMS"."Department" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "DSFMS"."User"("deletedAt");

-- CreateIndex
CREATE INDEX "Role_deletedAt_idx" ON "DSFMS"."Role"("deletedAt");

-- CreateIndex
CREATE INDEX "Permission_deletedAt_idx" ON "DSFMS"."Permission"("deletedAt");

-- CreateIndex
CREATE INDEX "Trainer_Profile_deletedAt_idx" ON "DSFMS"."Trainer_Profile"("deletedAt");

-- CreateIndex
CREATE INDEX "Trainee_Profile_deletedAt_idx" ON "DSFMS"."Trainee_Profile"("deletedAt");

-- CreateIndex
CREATE INDEX "Department_deletedAt_idx" ON "DSFMS"."Department"("deletedAt");

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "DSFMS"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DSFMS"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."User" ADD CONSTRAINT "User_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Role" ADD CONSTRAINT "Role_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Role" ADD CONSTRAINT "Role_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Permission" ADD CONSTRAINT "Permission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Permission" ADD CONSTRAINT "Permission_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainer_Profile" ADD CONSTRAINT "Trainer_Profile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DSFMS"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Trainee_Profile" ADD CONSTRAINT "Trainee_Profile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSFMS"."Department" ADD CONSTRAINT "Department_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "DSFMS"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
