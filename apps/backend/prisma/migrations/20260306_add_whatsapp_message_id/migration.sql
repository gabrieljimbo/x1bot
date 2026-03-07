-- AlterTable
ALTER TABLE "messages" ADD COLUMN "whatsappMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_whatsappMessageId_key" ON "messages"("conversationId", "whatsappMessageId");
