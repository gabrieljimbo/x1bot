import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Check if the request already has a request id (e.g. from reverse proxy)
        const requestId = (req.headers['x-request-id'] as string) || uuidv4();

        // Attach it to the request and response headers
        req.headers['x-request-id'] = requestId;
        res.setHeader('x-request-id', requestId);

        // Make it available for logging/interceptor via req object
        (req as any).id = requestId;

        next();
    }
}
