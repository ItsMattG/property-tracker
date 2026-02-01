-- Add locked field to properties table for trial expiry handling
ALTER TABLE "properties" ADD COLUMN "locked" BOOLEAN DEFAULT false NOT NULL;
