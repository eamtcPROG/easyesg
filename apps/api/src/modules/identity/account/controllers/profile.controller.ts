import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiObjectResponse } from '@api/app/decorators/api-envelope.decorator';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { AccountProfileResponseDto, SaveAccountProfileRequestDto } from '../dto/account-profile.dto';
import { ProfileService } from '../services/profile.service';

/**
 * `/api/v1/account/profile` — UC-13 and UC-14's API half, behind S-27 (task 52.3; FR-9, FR-10, FR-52, FR-169;
 * §12.5.6's task-52.3 row).
 *
 * **On the account's prefix** beside `/account/password`, for its reason: the profile is the person's, the same in
 * every organization they belong to (FR-9), so it needs no active membership. No account id in the path.
 *
 * `PUT` because S-27 is a Record that saves the whole profile at once, and repeating the save changes nothing more.
 * **No audit action and no field-change trail**, as for the password and the preferences: the profile is the person's
 * own and nobody else's decision is in it. **No `@RequiresEntitlement`**: no plan decides a person's own name or
 * languages, and the profile belongs to no organization whose plan could be asked.
 */
@ApiTags('identity')
@Controller('account/profile')
@RequiresAccount()
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Read the signed-in person’s profile',
    description:
      'Their name as two parts and as every surface shows it, the address they sign in with, an optional job title ' +
      'and phone number, and the three languages they chose: the interface’s, email’s and the export default.',
  })
  @ApiObjectResponse(AccountProfileResponseDto, { status: 200, description: 'The profile.' })
  async read(): Promise<AccountProfileResponseDto> {
    return new AccountProfileResponseDto(await this.profile.read());
  }

  @Put()
  @ApiOperation({
    summary: 'Save the signed-in person’s profile',
    description:
      'Replaces every field but the address, which is how the person signs in. A rename shows everywhere at once; ' +
      'a new interface language applies on every later sign-in and device, and a new email language to the next ' +
      'message sent.',
  })
  @ApiObjectResponse(AccountProfileResponseDto, { status: 200, description: 'The profile, as saved.' })
  @ApiResponse({
    status: 400,
    description:
      'A name part is missing, or the phone number is not in international form (problem type validation-failed). ' +
      'Nothing was saved.',
    content: { 'application/problem+json': {} },
  })
  async save(@Body() body: SaveAccountProfileRequestDto): Promise<AccountProfileResponseDto> {
    return new AccountProfileResponseDto(await this.profile.save(body));
  }
}
