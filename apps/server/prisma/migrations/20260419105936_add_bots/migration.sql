-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "avatar" TEXT,
    "description" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotCommand" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bot_username_key" ON "Bot"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_token_key" ON "Bot"("token");

-- CreateIndex
CREATE INDEX "Bot_ownerId_idx" ON "Bot"("ownerId");

-- CreateIndex
CREATE INDEX "Bot_token_idx" ON "Bot"("token");

-- CreateIndex
CREATE INDEX "Bot_username_idx" ON "Bot"("username");

-- CreateIndex
CREATE INDEX "BotCommand_botId_idx" ON "BotCommand"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "BotCommand_botId_command_key" ON "BotCommand"("botId", "command");

-- AddForeignKey
ALTER TABLE "BotCommand" ADD CONSTRAINT "BotCommand_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
