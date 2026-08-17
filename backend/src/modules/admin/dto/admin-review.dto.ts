import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class ReviewProfileChangeDto {
  @ApiProperty()
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class AdminMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;
}
