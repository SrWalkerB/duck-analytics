import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import type { GeneratedDashboard } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SaveAIConfigDto } from './dto/save-ai-config.dto';
import type { GenerateDashboardDto } from './dto/generate-dashboard.dto';
import type { GenerateComponentDto } from './dto/generate-component.dto';

@Controller('v1/ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private readonly service: AIService) {}

  @Get('config')
  getConfig(@CurrentUser() userId: string) {
    return this.service.getConfig(userId);
  }

  @Post('config')
  saveConfig(@CurrentUser() userId: string, @Body() dto: object) {
    return this.service.saveConfig(userId, dto as SaveAIConfigDto);
  }

  @Delete('config')
  deleteConfig(@CurrentUser() userId: string) {
    return this.service.deleteConfig(userId);
  }

  @Post('generate-dashboard')
  generateDashboard(@CurrentUser() userId: string, @Body() dto: object) {
    return this.service.generateDashboard(userId, dto as GenerateDashboardDto);
  }

  @Post('generate-component')
  generateComponent(@CurrentUser() userId: string, @Body() dto: object) {
    return this.service.generateComponent(userId, dto as GenerateComponentDto);
  }

  @Post('generate-dashboard/apply')
  applyDashboard(@CurrentUser() userId: string, @Body() dto: object) {
    const { dataSourceId, preview } = dto as {
      dataSourceId: string;
      preview: GeneratedDashboard;
    };
    return this.service.applyGeneratedDashboard(userId, dataSourceId, preview);
  }
}
