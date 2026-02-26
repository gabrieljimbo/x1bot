import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../types/roles.enum';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN bypasses workspace restrictions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // ADMIN must access only their own workspace
    const requestedTenantId = request.params?.tenantId || request.body?.tenantId || request.query?.tenantId;
    const userTenantId = user.tenantId;

    if (requestedTenantId && requestedTenantId !== userTenantId) {
      throw new ForbiddenException('Access denied: You can only access your own workspace');
    }

    return true;
  }
}

