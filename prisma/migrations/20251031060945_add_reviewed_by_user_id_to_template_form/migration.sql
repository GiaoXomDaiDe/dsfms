-- AlterTable
ALTER TABLE "DSFMS"."Template_Form" ADD COLUMN     "reviewedByUserId" UUID;

-- AddForeignKey
ALTER TABLE "DSFMS"."Template_Form" ADD CONSTRAINT "Template_Form_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "DSFMS"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
