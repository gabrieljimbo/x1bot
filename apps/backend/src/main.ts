import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Reduce logging in production
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  const reflector = app.get(Reflector);
  
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  // CORS configuration to allow localhost and ngrok
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Reduce logging in production
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 CORS Request from origin:', origin);
      }
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Allow localhost and ngrok domains
      if (
        origin.includes('localhost') ||
        origin.includes('ngrok-free.app') ||
        origin.includes('ngrok.io') ||
        origin.includes('ngrok.app') ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        console.warn('❌ CORS: Blocking origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
  
  console.log(`🚀 N9N Backend running on http://localhost:${port}`);
}

bootstrap();


