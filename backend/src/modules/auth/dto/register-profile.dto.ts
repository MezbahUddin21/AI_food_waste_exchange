import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ example: 23.8103 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 90.4125 })
  @IsLongitude()
  lng: number;
}

const ORG_TYPES = ['restaurant', 'supermarket', 'hotel', 'bakery', 'other'] as const;
const FOOD_CATEGORIES = ['cooked_meal', 'bakery', 'produce', 'dairy', 'packaged', 'other'] as const;
const VEHICLES = ['none', 'bike', 'motorbike', 'car', 'van'] as const;

export class RegisterProfileDto {
  @ApiProperty({ enum: ['donor', 'ngo', 'volunteer', 'government'] })
  @IsIn(['donor', 'ngo', 'volunteer', 'government']) // admin is provisioned manually
  role: 'donor' | 'ngo' | 'volunteer' | 'government';

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // Donor / NGO fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  orgName?: string;

  @ApiPropertyOptional({ enum: ORG_TYPES })
  @IsOptional()
  @IsIn(ORG_TYPES as unknown as string[])
  orgType?: (typeof ORG_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  // NGO fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  capacityMealsPerDay?: number;

  @ApiPropertyOptional({ enum: FOOD_CATEGORIES, isArray: true })
  @IsOptional()
  @IsIn(FOOD_CATEGORIES as unknown as string[], { each: true })
  acceptedFoodTypes?: (typeof FOOD_CATEGORIES)[number][];

  // Volunteer fields
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
}
