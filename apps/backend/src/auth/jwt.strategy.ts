import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { RedisService } from '../redis/redis.service';
import { UserRole } from './types/roles.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    // Single Session Check
    if (payload.sid) {
      const activeSid = await this.redisService.get(`auth:active_sid:${payload.sub}`);
      if (activeSid && activeSid !== payload.sid) {
        throw new UnauthorizedException('Multiple sessions detected');
      }
    }

    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    // Include role from JWT payload (more reliable than DB lookup)
    return {
      ...user,
      role: payload.role || user.role,
    };
  }
}


