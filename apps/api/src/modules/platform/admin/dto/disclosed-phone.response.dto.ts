import { ApiProperty } from '@nestjs/swagger';

/** A person's phone, disclosed to one operator once and recorded as such (task 167). */
export class DisclosedPhoneResponseDto {
  @ApiProperty({
    example: '+37369123456',
    description: 'In international form: a plus sign and the digits, as the person saved it on their profile.',
  })
  phone: string;

  constructor(disclosed: { readonly phone: string }) {
    this.phone = disclosed.phone;
  }
}
