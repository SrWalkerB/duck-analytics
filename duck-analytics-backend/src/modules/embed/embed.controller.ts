import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmbedService } from './embed.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { PublishDashboardDto } from './dto/publish-dashboard.dto';
import type { EmbedDataDto } from './dto/embed-data.dto';
import type { Request } from 'express';

@Controller('v1')
export class EmbedController {
  constructor(private readonly service: EmbedService) {}

  // ── Authenticated (owner) endpoints ──

  @Patch('dashboards/:id/publish')
  @UseGuards(JwtAuthGuard)
  publish(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.publish(id, userId, dto as PublishDashboardDto);
  }

  @Delete('dashboards/:id/publish')
  @UseGuards(JwtAuthGuard)
  unpublish(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.unpublish(id, userId);
  }

  @Put('dashboards/:id/embed-settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.updateSettings(id, userId, dto as PublishDashboardDto);
  }

  @Post('dashboards/:id/embed-token')
  @UseGuards(JwtAuthGuard)
  generateToken(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.generateToken(id, userId);
  }

  // ── Public embed endpoints ──

  @Get('embed/:code')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getEmbed(
    @Param('code') code: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.getEmbed(code, token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('embed/:code/data')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getEmbedData(
    @Param('code') code: string,
    @Query('token') token: string | undefined,
    @Body() dto: object,
    @Req() req: Request,
  ) {
    const { activeFilters = {} } = dto as EmbedDataDto;
    return this.service.getEmbedData(code, token, activeFilters, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('embed/:code/filters/:filterId/values')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getFilterValues(
    @Param('code') code: string,
    @Param('filterId') filterId: string,
    @Query('token') token: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('search') search: string | undefined,
    @Query('parentValue') parentValue: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.getEmbedFilterValues(code, filterId, token, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
      parentValue,
    }, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
