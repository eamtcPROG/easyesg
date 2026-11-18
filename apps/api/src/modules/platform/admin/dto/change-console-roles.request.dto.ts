import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn } from 'class-validator';
import { CONSOLE_ROLE, type ConsoleRole } from '../models/console-role.model';

/** A-08's role assignment (task 67.13; FR-80 behaviour 10) — the whole set an account will hold, at least one. */
export class ChangeConsoleRolesRequestDto {
  @ApiProperty({
    enum: Object.values(CONSOLE_ROLE),
    isArray: true,
    minItems: 1,
    description: 'Every role the account holds after the change. A role not named is taken away.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(Object.values(CONSOLE_ROLE), { each: true })
  roles!: ConsoleRole[];
}
