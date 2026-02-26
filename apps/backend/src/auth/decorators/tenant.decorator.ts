import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../types/roles.enum';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    // SUPER_ADMIN can access any tenant via query param or use their own
    if (user.role === UserRole.SUPER_ADMIN) {
      const requestedTenantId = request.query?.tenantId || request.params?.tenantId;
      return requestedTenantId || user.tenantId;
    }

    // ADMIN can only access their own tenant
    return user.tenantId;
  },
);


