-- Fix roles by ensuring they match the enum exactly
UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'SUPERADMIN';
UPDATE users SET role = 'ADMIN' WHERE role = 'ADMINISTRATOR';
UPDATE users SET role = 'USER' WHERE role IS NULL;

-- Fix licenseStatus
UPDATE users SET "licenseStatus" = 'ACTIVE' WHERE "licenseStatus" IS NULL;
UPDATE users SET "licenseStatus" = 'ACTIVE' WHERE "licenseStatus" = 'active'; -- ensure uppercase

-- Fix tenants
UPDATE tenants SET "isActive" = true WHERE "isActive" IS NULL;
