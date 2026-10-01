-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_CHANGE_FAILED', 'PASSWORD_RESET', 'ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'ACCOUNT_DELETED', 'SHARE_LINK_CREATED', 'SHARE_LINK_REVOKED', 'SHARE_LINK_RESTORED', 'ITEM_PURGED', 'DATA_EXPORTED');

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "SecurityEventType" NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" JSONB,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_occurredAt_idx" ON "SecurityEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_organizationId_occurredAt_idx" ON "SecurityEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_occurredAt_idx" ON "SecurityEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_actorId_occurredAt_idx" ON "SecurityEvent"("actorId", "occurredAt");
