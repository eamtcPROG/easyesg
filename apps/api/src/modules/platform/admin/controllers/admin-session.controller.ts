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
import {
  readAdminChallengeCookie,
  readAdminSessionCookie,
} from '../constants/admin-session.constants';
import { AdminChallengeRequestDto } from '../dto/admin-challenge.request.dto';
import { AdminChallengeResponseDto } from '../dto/admin-challenge.response.dto';
import { AdminFactorRequestDto } from '../dto/admin-factor.request.dto';
import { AdminSessionResponseDto } from '../dto/admin-session.response.dto';
import { AdminOriginGuard } from '../guards/admin-origin.guard';
import { AdminSessionService } from '../services/admin-session.service';

const PROBLEM_MEDIA_TYPE = 'application/problem+json';
const SET_COOKIE = 'set-cookie';

/**
 * `/api/v1/auth/admin/session` — the admin realm's token handler (OQ-17; FR-75, UC-68;
 * task 23, reshaped to A-01's two-step handshake by the 24 Aug 2026 review). The sibling
 * routes the tenant `SessionController` promised, on the same public, OpenAPI-diffed surface
 * (DR-11, P-5) — a handler at `edge` was rejected because no contract test would ever see it.
 *
 * The handshake: `POST session/challenge` verifies the credential and answers with a sealed
 * five-minute challenge cookie; `POST session` presents the TOTP code against it and answers
 * with the sealed session cookie (clearing the challenge). **No token and no challenge ever
 * appears in a body** — the console is a static SPA, and a readable value would put it exactly
 * where AD-12 says it must never be. `@Res({ passthrough: true })` keeps the envelope
 * interceptor in the loop while the headers are set.
 *
 * No refresh route, deliberately: rotation is server-side, inside `GET`'s resolve, because the
 * api holds both ends of the exchange. And every route here stays public when task 28's guard
 * chain arrives — they are how an admin session comes to exist, and `GET` is the probe the
 * console's router asks "am I signed in" through.
 */
@ApiTags('platform')
@UseGuards(AdminOriginGuard)
@Controller('auth/admin')
export class AdminSessionController {
  constructor(private readonly adminSessionService: AdminSessionService) {}

  @Post('session/challenge')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Verify the elevated credential and open the second-factor challenge',
    description:
      'UC-68 step one. Verifies email and password; on success the sealed, five-minute factor ' +
      'challenge rides an httpOnly cookie and the body names whose code is now awaited. ' +
      'Failures are uniform for unknown and deactivated operators alike, throttled per ' +
      'address, and locked after repeated failure.',
  })
  @ApiObjectResponse(AdminChallengeResponseDto, {
    status: 201,
    description: 'The credential held; the factor challenge is open and rides the cookie.',
  })
  @ApiResponse({
    status: 401,
    description:
      'The email address or the password is not right — one answer for both (problem type ' +
      'credential-invalid).',
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
  async beginSignIn(
    @Body() body: AdminChallengeRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminChallengeResponseDto> {
    const view = await this.adminSessionService.beginSignIn(body);
    response.setHeader(SET_COOKIE, view.setCookie);
    return new AdminChallengeResponseDto(view);
  }

  @Post('session')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Complete sign-in with the second factor',
    description:
      'UC-68 step two. Judges the TOTP code against the challenge cookie step one set; on ' +
      'success the session is established as a sealed httpOnly cookie and the challenge is ' +
      'cleared — no token appears in the body (FR-75: the factor is mandatory, without ' +
      'exception).',
  })
  @ApiObjectResponse(AdminSessionResponseDto, {
    status: 201,
    description: 'The session was established; the cookie carries it.',
  })
  @ApiResponse({
    status: 401,
    description:
      'No open challenge, or it lapsed (problem type authentication-required — sign-in ' +
      'restarts from the credential); or the code is wrong (problem type factor-invalid, ' +
      'disclosed only past the credential bar — the challenge stays open for a retype).',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 403,
    description:
      'The operator account is locked (problem type admin-account-locked) — a wrong code ' +
      'counts toward the same threshold as a wrong password.',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many attempts for this address in the window. Identical either way.',
    content: { [PROBLEM_MEDIA_TYPE]: {} },
  })
  async completeSignIn(
    @Body() body: AdminFactorRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminSessionResponseDto> {
    const view = await this.adminSessionService.completeSignIn(
      readAdminChallengeCookie(request.headers.cookie),
      body,
    );
    if (view.setCookies) response.setHeader(SET_COOKIE, [...view.setCookies]);
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
    if (view.setCookies) response.setHeader(SET_COOKIE, [...view.setCookies]);
    return new AdminSessionResponseDto(view);
  }

  @Delete('session')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Sign out of the administrative realm',
    description:
      'Revokes the session server-side and clears the cookies — any half-open factor ' +
      'challenge included. Idempotent, and identical for cookies that were never real — ' +
      'signing out is not an endpoint that confirms anything.',
  })
  @ApiResponse({ status: 204, description: 'The session is terminated, or already was.' })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { clearCookies } = await this.adminSessionService.signOut(
      readAdminSessionCookie(request.headers.cookie),
    );
    response.setHeader(SET_COOKIE, [...clearCookies]);
  }
}
