import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, headers } = request;
        const userAgent = headers['user-agent'] || '';
        const ip = request.ip;
        const requestId = request.id || 'N/A';
        const startTime = Date.now();

        // Sensitive fields to redact
        const redactBody = (data: any) => {
            if (!data) return data;
            const clone = { ...data };
            const sensitiveKeys = ['password', 'token', 'secret', 'client_secret', 'apiKey', 'authorization'];

            Object.keys(clone).forEach(key => {
                if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                    clone[key] = '[REDACTED]';
                } else if (typeof clone[key] === 'object' && clone[key] !== null) {
                    clone[key] = redactBody(clone[key]);
                }
            });
            return clone;
        };

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const duration = Date.now() - startTime;
                    this.logger.log({
                        requestId,
                        method,
                        url,
                        ip,
                        userAgent,
                        duration,
                        status: context.switchToHttp().getResponse().statusCode,
                        body: redactBody(body),
                        // Avoid logging large response bodies unless specifically needed
                    }, `HTTP Success [${requestId}]`);
                },
                error: (err) => {
                    const duration = Date.now() - startTime;
                    this.logger.error({
                        requestId,
                        method,
                        url,
                        ip,
                        userAgent,
                        duration,
                        status: err.status || 500,
                        message: err.message,
                        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
                        body: redactBody(body),
                    }, `HTTP Error [${requestId}]`);
                },
            }),
        );
    }
}
