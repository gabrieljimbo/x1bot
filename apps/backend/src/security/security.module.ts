import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'throttler-storage-redis';
import { Redis } from 'ioredis';

@Global()
@Module({
    imports: [
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService): ThrottlerModuleOptions => {
                const redisHost = config.get<string>('REDIS_HOST', 'localhost');
                const redisPort = config.get<number>('REDIS_PORT', 6379);
                const redisPassword = config.get<string>('REDIS_PASSWORD');

                // Use a dedicated Redis instance for throttling to avoid blocking main logic
                const storage = new ThrottlerStorageRedisService(
                    new Redis({
                        host: redisHost,
                        port: redisPort,
                        password: redisPassword,
                        keyPrefix: 'throttle:',
                    }),
                );

                return {
                    throttlers: [
                        {
                            name: 'global',
                            ttl: 60000, // 1 minute
                            limit: 100, // 100 requests per minute
                        },
                        {
                            name: 'auth',
                            ttl: 60000,
                            limit: 5, // Strict limit for auth routes
                        },
                        {
                            name: 'webhook',
                            ttl: 1000,
                            limit: 10, // 10 per second
                        },
                        {
                            name: 'heavy',
                            ttl: 60000,
                            limit: 2, // 2 per minute for heavy routes
                        }
                    ],
                    storage,
                };
            },
        }),
    ],
    exports: [ThrottlerModule],
})
export class SecurityModule { }
