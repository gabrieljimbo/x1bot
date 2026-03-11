import { webcrypto } from 'node:crypto';

// Polyfill for Node.js 18 to support @whiskeysockets/baileys
// Must be at the very top before other imports that might depend on it
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Reduce logging in production
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const reflector = app.get(Reflector);

  // Trust Proxy for Traefik/Reverse Proxy
  // Essential for correct IP detection and secure cookies
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Calibrate based on frontend requirements
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));
  app.use(cookieParser());

  // Capture Raw Body for HMAC validation (e.g. webhooks)
  app.use(json({
    limit: '10mb',
    verify: (req: any, res, buf) => {
      if (req.url.includes('/webhook')) {
        req.rawBody = buf;
      }
    },
  }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Global Middlewares
  app.use(new RequestIdMiddleware().use);

  // Global Guards & Interceptors
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.useGlobalInterceptors(new LoggingInterceptor());

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    'https://x1bot.cloud',
    'https://api.n9n.archcode.space'
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'Accept',
      'Origin',
      'x-hmac-signature', 
      'x-timestamp'
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 X1Bot Backend running on http://localhost:${port}`);
}

bootstrap();


