import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { CurrentUser } from "../../shared/decorators/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Initiate HeadHunter OAuth flow
   * Redirects user to HH authorization page
   */
  @Get("hh")
  async initiateHhAuth(@Res() res: Response, @Query("state") state?: string) {
    const authUrl = this.authService.getAuthorizationUrl(state);
    return res.redirect(authUrl);
  }

  /**
   * OAuth callback from HeadHunter
   * Exchanges authorization code for tokens and creates/updates user
   */
  @Get("hh/callback")
  async hhCallback(
    @Query("code") code: string,
    @Query("error") error: string,
    @Res() res: Response,
    @Query("state") state?: string
  ) {
    // Check if this is a mobile app request
    const isMobile = state === "mobile";

    if (error) {
      // User denied access
      console.error("OAuth error from HH:", error);
      if (isMobile) {
        return res.redirect(
          `jobjam://auth/callback?error=${encodeURIComponent(error)}`
        );
      }
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      console.error("No authorization code received from HH");
      if (isMobile) {
        return res.redirect(`jobjam://auth/callback?error=no_code`);
      }
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/auth/login?error=no_code`);
    }

    try {
      console.log(
        "Processing OAuth callback with code:",
        code.substring(0, 10) + "..."
      );
      const { user, token } = await this.authService.handleOAuthCallback(code);
      console.log("OAuth callback successful, user ID:", user.id);

      if (isMobile) {
        // Redirect to mobile app with deep link
        // URL encode token to handle special characters
        const encodedToken = encodeURIComponent(token);
        console.log("Redirecting to mobile app with token");
        return res.redirect(`jobjam://auth/callback?token=${encodedToken}`);
      }

      // Redirect to web frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const encodedToken = encodeURIComponent(token);
      return res.redirect(`${frontendUrl}/auth/callback?token=${encodedToken}`);
    } catch (error: any) {
      console.error("OAuth callback error:", error.message || error);
      if (isMobile) {
        const errorMessage = error.message || "oauth_failed";
        return res.redirect(
          `jobjam://auth/callback?error=${encodeURIComponent(errorMessage)}`
        );
      }
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const errorMessage = error.message || "oauth_failed";
      return res.redirect(
        `${frontendUrl}/auth/login?error=${encodeURIComponent(errorMessage)}`
      );
    }
  }

  /**
   * Get current authenticated user
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    // Remove sensitive fields
    const { password, hhAccessToken, hhRefreshToken, ...userWithoutSensitive } =
      user;
    return userWithoutSensitive;
  }
}
