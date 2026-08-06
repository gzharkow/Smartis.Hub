-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "demoLabel" TEXT NOT NULL DEFAULT 'Демо-кабинет',
ADD COLUMN     "demoNote" TEXT,
ADD COLUMN     "demoUrl" TEXT;
