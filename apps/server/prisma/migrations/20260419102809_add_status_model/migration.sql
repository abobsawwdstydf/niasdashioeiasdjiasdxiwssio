-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "emoji" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Status_userId_key" ON "Status"("userId");

-- CreateIndex
CREATE INDEX "Status_userId_idx" ON "Status"("userId");

-- CreateIndex
CREATE INDEX "Status_expiresAt_idx" ON "Status"("expiresAt");
