import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { readAdminSessionCookie } from '../constants/admin-session.constants';
import { AdminSessionResponseDto } from '../dto/admin-session.response.dto';
import { AdminSignInRequestDto } from '../dto/admin-sign-in.request.dto';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AdminSessionService } from '../services/admin-session.service';

const PROBLEM_MEDIA_TYPE = 'application/problem+json';
const SET_COOKIE = 'set-cookie';

/**
 * `/api/v1/auth/admin/session` — the admin realm's token handler (OQ-17; FR-75, UC-68;
 * task 23). The sibling route the tenant `SessionController` promised, on the same public,
 * OpenAPI-diffed surface (DR-11, P-5) — a handler at `edge` was rejected because no contract
 * test would ever see it.
 *
 * **The tokens live in the cookie and nowhere else.** Every response that changes the session
 * answers with `Set-Cookie` on the sealed httpOnly cookie and a body carrying only the
 * operator's identity block — the console is a static SPA, and a token in a readable body
 * would put it exactly where AD-12 says it must never be. `@Res({ passthrough: true })` keeps
 * the envelope interceptor in the loop while the header is set.
 *
 * No refresh route, deliberately: rotation is server-side, inside `GET`'s resolve, because the
 * api holds both ends of the exchange. And all three routes stay public when task 28's guard
 * chain arrives — they are how an admin session comes to exist, and `GET` is the probe the
 * console's router asks "am I signed in" through.
 */
@ApiTags('platform')
@UseGuards(AdminOriginGuard)
@Controller('auth/admin')
export class AdminSessionController {
  constructor(private readonly adminSessionService: AdminSessionService) {}

  @Post('session')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Sign in to the administrative realm',
    description:
      'Verifies the elevated credential and the mandatory TOTP code (FR-75), and establishes ' +
      'the session as a sealed httpOnly cookie — no token appears in the body. Failures are ' +
      'uniform for unknown and deactivated operators alike, throttled per address, and locked ' +
      'after repeated failure.',
  })
  @ApiObjectResponse(AdminSessionResponseDto, {
    status: 201,
    description: 'The session was established; the cookie carries it.',
  })
  @ApiResponse({
    status: 401,
    description:
      'The email address or the password is not right (one answer for both, problem type ' +
      'credential-invalid) — or the password is right and the code is not (problem type ' +
      'factor-invalid, disclosed only past the credential bar).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The operator account is locked after repeated failures (problem type ' +
      'admin-account-locked; released by another administrator or the provisioning CLI).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many attempts for this address in the window. Identical either way.',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  async signIn(
    @Body() body: AdminSignInRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminSessionResponseDto> {
    const view = await this.adminSessionService.signIn(body);
    if (view.setCookie) response.setHeader(SET_COOKIE, view.setCookie);
    return new AdminSessionResponseDto(view);
  }

  @Get('session')
  @ApiOperation({
    summary: 'Read the current administrative session',
    description:
      'The console router’s probe. Judges the sealed cookie: a live access token answers ' +
      'directly; an expired one is rotated server-side and the successor cookie set on this ' +
      'response. 401 means sign in again.',
  })
  @ApiObjectResponse(AdminSessionResponseDto, {
    status: 200,
    description: 'The current session, rotated if its access token had expired.',
  })
  @ApiResponse({
    status: 401,
    description:
      'No usable session (problem type authentication-required), or its lifetimes ran out ' +
      '(problem type session-expired).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  async currentSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminSessionResponseDto> {
    const view = await this.adminSessionService.resolve(
      readAdminSessionCookie(request.headers.cookie),
    );
    if (view.setCookie) response.setHeader(SET_COOKIE, view.setCookie);
    return new AdminSessionResponseDto(view);
  }

  @Delete('session')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sign out of the administrative realm',
    description:
      'Revokes the session server-side and clears the cookie. Idempotent, and identical for ' +
      'cookies that were never real — signing out is not an endpoint that confirms anything.',
  })
  @ApiResponse({ status: 204, description: 'The session is terminated, or already was.' })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { clearCookie } = await this.adminSessionService.signOut(
      readAdminSessionCookie(request.headers.cookie),
    );
    response.setHeader(SET_COOKIE, clearCookie);
  }
}
