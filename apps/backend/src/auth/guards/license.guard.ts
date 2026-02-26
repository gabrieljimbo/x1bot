import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../types/roles.enum';

@Injectable()
export class LicenseGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // SUPER_ADMIN and ADMIN never blocked
        if (
            user.role === UserRole.SUPER_ADMIN ||
            user.role === UserRole.ADMIN
        ) {
            return true;
        }

        const now = new Date();

        // Check VIP license
        if (user.role === UserRole.VIP) {
            if (user.licenseStatus !== 'ACTIVE') {
                throw new ForbiddenException(
                    'Seu acesso expirou. Entre em contato para renovar.',
                );
            }

            if (user.licenseExpiresAt && new Date(user.licenseExpiresAt) < now) {
                throw new ForbiddenException(
                    'Seu acesso expirou. Entre em contato para renovar.',
                );
            }

            return true;
        }

        // Check USER trial
        if (user.role === UserRole.USER) {
            if (user.trialEndsAt && new Date(user.trialEndsAt) < now) {
                throw new ForbiddenException(
                    'Seu acesso expirou. Entre em contato para renovar.',
                );
            }

            return true;
        }

        return true;
    }
}
