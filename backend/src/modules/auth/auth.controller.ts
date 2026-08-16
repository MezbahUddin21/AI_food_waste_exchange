import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators';
import type { AuthUser } from './auth.types';
import { RegisterProfileDto } from './dto/register-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('auth/register-profile')
  @ApiOperation({ summary: 'Create role profile after Supabase signup' })
  registerProfile(@CurrentUser() user: AuthUser, @Body() dto: RegisterProfileDto) {
    return this.auth.registerProfile(user, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user + role profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the verified user profile and role details' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateMe(user, dto);
  }
}
