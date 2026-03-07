-- AlterTable (safe: adds column only if it doesn't exist)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT;

-- CreateIndex (safe: creates index only if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversationId_whatsappMessageId_key" ON "messages"("conversationId", "whatsappMessageId");
