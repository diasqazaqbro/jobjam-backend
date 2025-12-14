import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../entities/user/user.service';
import { HHApiService, HHUserInfo, HHTokenResponse } from '../../shared/services/hh-api.service';
import { User, Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private hhApiService: HHApiService,
  ) {}

  /**
   * Get HeadHunter OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    return this.hhApiService.getAuthorizationUrl(state);
  }

  /**
   * Handle OAuth callback - exchange code for token and create/update user
   */
  async handleOAuthCallback(code: string): Promise<{ user: Omit<User, 'password' | 'hhAccessToken' | 'hhRefreshToken'>; token: string }> {
    // Exchange code for access token
    const tokenResponse: HHTokenResponse = await this.hhApiService.getAccessToken(code);

    // Get user info from HH
    const hhUserInfo: HHUserInfo = await this.hhApiService.getUserInfo(tokenResponse.access_token);

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Determine role based on HH user info
    let role: Role = Role.USER;
    if (hhUserInfo.is_employer) {
      role = Role.EMPLOYER;
    }

    // Find or create user
    let user = await this.userService.findByHhId(hhUserInfo.id);

    if (user) {
      // Update existing user
      user = await this.userService.updateHhTokens(user.id, {
        hhAccessToken: tokenResponse.access_token,
        hhRefreshToken: tokenResponse.refresh_token,
        hhExpiresAt: expiresAt,
        firstName: hhUserInfo.first_name,
        lastName: hhUserInfo.last_name,
        email: hhUserInfo.email,
        phone: hhUserInfo.phone,
        role,
      });
    } else {
      // Create new user
      user = await this.userService.createFromHh({
        hhId: hhUserInfo.id,
        email: hhUserInfo.email,
        firstName: hhUserInfo.first_name,
        lastName: hhUserInfo.last_name,
        middleName: hhUserInfo.middle_name,
        phone: hhUserInfo.phone,
        role,
        hhAccessToken: tokenResponse.access_token,
        hhRefreshToken: tokenResponse.refresh_token,
        hhExpiresAt: expiresAt,
        companyName: hhUserInfo.employer?.name,
      });
    }

    // Generate JWT token
    const token = this.generateJwtToken(user);

    // Remove sensitive data from response
    const { password, hhAccessToken, hhRefreshToken, ...userWithoutSensitive } = user;

    return { user: userWithoutSensitive, token };
  }

  /**
   * Refresh HH access token
   */
  async refreshHhToken(userId: string): Promise<{ user: Omit<User, 'password' | 'hhAccessToken' | 'hhRefreshToken'>; token: string }> {
    const user = await this.userService.findById(userId);
    if (!user || !user.hhRefreshToken) {
      throw new UnauthorizedException('User not found or no refresh token');
    }

    // Check if token is expired
    if (user.hhExpiresAt && user.hhExpiresAt > new Date()) {
      // Token is still valid, return current user
      const token = this.generateJwtToken(user);
      const { password, hhAccessToken, hhRefreshToken, ...userWithoutSensitive } = user;
      return { user: userWithoutSensitive, token };
    }

    // Refresh token
    const tokenResponse: HHTokenResponse = await this.hhApiService.refreshAccessToken(user.hhRefreshToken);

    // Calculate new expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    // Update user tokens
    const updatedUser = await this.userService.updateHhTokens(userId, {
      hhAccessToken: tokenResponse.access_token,
      hhRefreshToken: tokenResponse.refresh_token,
      hhExpiresAt: expiresAt,
    });

    // Generate new JWT token
    const token = this.generateJwtToken(updatedUser);

    // Remove sensitive data
    const { password, hhAccessToken, hhRefreshToken, ...userWithoutSensitive } = updatedUser;

    return { user: userWithoutSensitive, token };
  }

  /**
   * Get valid HH access token (refresh if needed)
   */
  async getValidHhAccessToken(userId: string): Promise<string> {
    const user = await this.userService.findById(userId);
    if (!user || !user.hhAccessToken) {
      throw new UnauthorizedException('User not found or no HH token');
    }

    // Check if token is expired
    if (user.hhExpiresAt && user.hhExpiresAt <= new Date()) {
      // Token expired, refresh it
      await this.refreshHhToken(userId);
      // Get updated user with new token
      const updatedUser = await this.userService.findById(userId);
      if (!updatedUser || !updatedUser.hhAccessToken) {
        throw new UnauthorizedException('Failed to refresh HH token');
      }
      return updatedUser.hhAccessToken;
    }

    return user.hhAccessToken;
  }

  generateJwtToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }
}
