import {
    Injectable,
    CanActivate,
    ExecutionContext,
} from '@nestjs/common';

@Injectable()
export class LicenseGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) return true; // public routes

        // SUPER_ADMIN and ADMIN always pass
        if (
            user.role === 'SUPER_ADMIN' ||
            user.role === 'ADMIN'
        ) return true;

        // VIP - check active license
        if (user.role === 'VIP') {
            if (user.licenseStatus !== 'ACTIVE') return false;
            if (user.licenseExpiresAt && new Date(user.licenseExpiresAt) < new Date()) return false;
            return true;
        }

        // USER - check trial
        if (user.role === 'USER') {
            if (!user.trialEndsAt) return true;
            if (new Date(user.trialEndsAt) < new Date()) return false;
            return true;
        }

        return false;
    }
}
