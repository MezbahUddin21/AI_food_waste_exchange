import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FOOD_CATEGORIES = ['cooked_meal', 'bakery', 'produce', 'dairy', 'packaged', 'other'] as const;
const STORAGE = ['room_temp', 'refrigerated', 'frozen', 'hot_held'] as const;
const PACKAGING = ['sealed', 'covered', 'open'] as const;

export class CreateDonationDto {
  @ApiProperty({ example: '20 chicken biryani boxes' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: FOOD_CATEGORIES })
  @IsIn(FOOD_CATEGORIES as unknown as string[])
  foodCategory: (typeof FOOD_CATEGORIES)[number];

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(100000)
  quantityServings: number;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityKg?: number;

  @ApiPropertyOptional({ type: [String], description: 'Supabase Storage public URLs' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  photoUrls?: string[];

  @ApiProperty({ example: '2026-08-01T11:30:00Z' })
  @IsDateString()
  preparedAt: string;

  @ApiProperty({ enum: STORAGE })
  @IsIn(STORAGE as unknown as string[])
  storage: (typeof STORAGE)[number];

  @ApiProperty({ enum: PACKAGING })
  @IsIn(PACKAGING as unknown as string[])
  packaging: (typeof PACKAGING)[number];

  @ApiPropertyOptional({ description: 'Ambient temperature °C, improves spoilage estimate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ambientTempC?: number;
}

export class ListDonationsQueryDto {
  @ApiPropertyOptional({ enum: ['listed', 'claimed', 'assigned', 'in_transit', 'delivered', 'verified', 'expired', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: FOOD_CATEGORIES })
  @IsOptional()
  @IsIn(FOOD_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional({ description: 'lat,lng,km — e.g. 23.81,90.41,10' })
  @IsOptional()
  @IsString()
  near?: string;
}
