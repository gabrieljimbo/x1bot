const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'apps', 'backend', 'prisma', 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

const addition = `
model LeadOrigin {
  id            String   @id @default(cuid())
  tenantId      String
  sessionId     String
  contactPhone  String
  isFromAd      Boolean  @default(false)
  adSourceId    String?
  adCtwaClid    String?
  adTitle       String?
  adBody        String?
  adSourceUrl   String?
  adMediaUrl    String?
  contactState  String?
  contactDDD    String?
  contactName   String?
  workflowId    String?
  receivedAt    DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, isFromAd])
  @@index([tenantId, contactState])
  @@index([receivedAt])
  @@map("lead_origins")
}

model TenantPixelConfig {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  pixelId         String?
  accessToken     String?
  testEventCode   String?
  autoSendLead    Boolean  @default(false)
  includeState    Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("tenant_pixel_configs")
}
`;

// Only add if not already there
if (!content.includes('lead_origins')) {
    content = content.trimEnd() + '\n' + addition;
    fs.writeFileSync(schemaPath, content, 'utf8');
    console.log('Schema updated successfully');
} else {
    console.log('Schema already has LeadOrigin — skipping');
}
