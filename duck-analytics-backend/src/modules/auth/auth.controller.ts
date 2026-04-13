import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { SignUpDto } from './dto/sign-up.dto';
import type { SignInDto } from './dto/sign-in.dto';
import type { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  signUp(@Body() dto: object) {
    return this.authService.signUp(dto as SignUpDto);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: object) {
    return this.authService.signIn(dto as SignInDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() userId: string) {
    return this.authService.me(userId);
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  updatePreferences(@CurrentUser() userId: string, @Body() dto: object) {
    return this.authService.updatePreferences(
      userId,
      dto as UpdateUserPreferencesDto,
    );
  }
}
