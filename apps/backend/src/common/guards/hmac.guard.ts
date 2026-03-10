import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class HmacGuard implements CanActivate {
    private readonly logger = new Logger(HmacGuard.name);

    constructor(private configService: ConfigService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const signature = request.headers['x-hmac-signature'];
        const timestamp = request.headers['x-timestamp'];
        const secret = this.configService.get<string>('WEBHOOK_SECRET');

        if (!signature || !timestamp || !secret) {
            this.logger.warn('HMAC validation failed: Missing signature, timestamp, or secret');
            throw new UnauthorizedException('Invalid signature');
        }

        // Anti-replay window (e.g., 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp, 10);
        const tolerance = 300; // 5 minutes

        if (Math.abs(now - requestTime) > tolerance) {
            this.logger.warn(`HMAC validation failed: Timestamp out of range (${requestTime} vs ${now})`);
            throw new UnauthorizedException('Signature expired');
        }

        // Get the raw body. 
        // This requires a middleware/config in main.ts to populate req['rawBody']
        const rawBody = request.rawBody;
        if (!rawBody) {
            this.logger.error('HMAC validation failed: Raw body not available. Check main.ts configuration.');
            throw new UnauthorizedException('Internal validation error');
        }

        // Reconstruct the payload to sign: timestamp + '.' + rawBody
        const payload = `${timestamp}.${rawBody.toString()}`;
        const expectedSignature = createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        // Constant-time comparison to prevent timing attacks
        const isMatched = timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );

        if (!isMatched) {
            this.logger.warn('HMAC validation failed: Invalid signature match');
            throw new UnauthorizedException('Invalid signature');
        }

        return true;
    }
}
