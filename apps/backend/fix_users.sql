UPDATE users SET "licenseStatus" = 'ACTIVE' WHERE "licenseStatus" IS NULL;
UPDATE users SET role = 'ADMIN' WHERE role IS NULL;
