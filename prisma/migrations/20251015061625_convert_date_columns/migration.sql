ALTER TABLE "Trainee_Profile"
  ALTER COLUMN "dob" TYPE DATE USING ("dob"::date),
  ALTER COLUMN "enrollmentDate" TYPE DATE USING ("enrollmentDate"::date);

ALTER TABLE "Course"
  ALTER COLUMN "startDate" TYPE DATE USING ("startDate"::date),
  ALTER COLUMN "endDate" TYPE DATE USING ("endDate"::date);

ALTER TABLE "Subject"
  ALTER COLUMN "startDate" TYPE DATE USING ("startDate"::date),
  ALTER COLUMN "endDate" TYPE DATE USING ("endDate"::date);

ALTER TABLE "Subject_Enrollment"
  ALTER COLUMN "enrollmentDate" TYPE DATE USING ("enrollmentDate"::date);