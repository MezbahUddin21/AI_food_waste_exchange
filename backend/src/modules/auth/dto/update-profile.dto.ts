import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ORG_TYPES = ['restaurant', 'supermarket', 'hotel', 'bakery', 'other'] as const;
const FOOD_CATEGORIES = ['cooked_meal', 'bakery', 'produce', 'dairy', 'packaged', 'other'] as const;
const VEHICLES = ['none', 'bike', 'motorbike', 'car', 'van'] as const;

export class UpdateLocationDto {
  @ApiPropertyOptional({ example: 23.8103 })
  @IsLatitude()
  lat: number;

  @ApiPropertyOptional({ example: 90.4125 })
  @IsLongitude()
  lng: number;
}

/** Fields may be supplied only by the matching role; the service enforces that scope. */
export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  orgName?: string;

  @ApiPropertyOptional({ enum: ORG_TYPES })
  @IsOptional()
  @IsIn(ORG_TYPES as unknown as string[])
  orgType?: (typeof ORG_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ type: UpdateLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLocationDto)
  location?: UpdateLocationDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  capacityMealsPerDay?: number;

  @ApiPropertyOptional({ enum: FOOD_CATEGORIES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsIn(FOOD_CATEGORIES as unknown as string[], { each: true })
  acceptedFoodTypes?: (typeof FOOD_CATEGORIES)[number][];

  @ApiPropertyOptional({ enum: VEHICLES })
  @IsOptional()
  @IsIn(VEHICLES as unknown as string[])
  vehicleType?: (typeof VEHICLES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCarryKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  serviceRadiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
