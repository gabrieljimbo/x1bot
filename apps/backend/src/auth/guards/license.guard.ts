import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { UserRole } from '../types/roles.enum';

@Injectable()
export class LicenseGuard implements CanActivate {
    private readonly logger = new Logger(LicenseGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            this.logger.warn('LicenseGuard: No user found in request');
            return false;
        }

        const role = user.role;

        // SUPER_ADMIN and ADMIN ALWAYS bypass — check both enum and string values
        // to handle old JWT tokens that might have legacy role names
        if (
            role === UserRole.SUPER_ADMIN ||
            role === UserRole.ADMIN ||
            role === 'SUPER_ADMIN' ||
            role === 'ADMIN' ||
            role === 'SUPERADMIN' // legacy format before standardization
        ) {
            return true;
        }

        const now = new Date();

        // Check VIP license
        if (role === UserRole.VIP || role === 'VIP') {
            // If licenseStatus is not set, allow access (avoid blocking on null)
            if (!user.licenseStatus || user.licenseStatus === 'ACTIVE') {
                if (user.licenseExpiresAt && new Date(user.licenseExpiresAt) < now) {
                    throw new ForbiddenException(
                        'Seu acesso expirou. Entre em contato para renovar.',
                    );
                }
                return true;
            }

            if (user.licenseStatus === 'EXPIRED' || user.licenseStatus === 'SUSPENDED') {
                throw new ForbiddenException(
                    'Seu acesso expirou. Entre em contato para renovar.',
                );
            }

            // TRIAL status for VIP — check trial expiry
            if (user.licenseStatus === 'TRIAL') {
                if (user.trialEndsAt && new Date(user.trialEndsAt) < now) {
                    throw new ForbiddenException(
                        'Seu período de teste expirou. Entre em contato para renovar.',
                    );
                }
                return true;
            }

            return true;
        }

        // Check USER trial
        if (role === UserRole.USER || role === 'USER') {
            // If licenseStatus is EXPIRED or SUSPENDED, block
            if (user.licenseStatus === 'EXPIRED' || user.licenseStatus === 'SUSPENDED') {
                throw new ForbiddenException(
                    'Seu acesso expirou. Entre em contato para renovar.',
                );
            }

            // Check trial expiry
            if (user.trialEndsAt && new Date(user.trialEndsAt) < now) {
                throw new ForbiddenException(
                    'Seu período de teste expirou. Entre em contato para renovar.',
                );
            }

            return true;
        }

        // Unknown role — allow access (don't block unexpectedly)
        this.logger.warn(`LicenseGuard: Unknown role "${role}" for user ${user.id}, allowing access`);
        return true;
    }
}
