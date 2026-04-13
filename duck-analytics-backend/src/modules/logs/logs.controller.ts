import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { LogsService } from '../../lib/logs/logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('v1/logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  findAll(
    @CurrentUser() userId: string,
    @Query('source') source?: string,
    @Query('level') level?: string,
    @Query('event') event?: string,
    @Query('resourceId') resourceId?: string,
    @Query('since') since?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.logs.findAll(userId, {
      source,
      level,
      event,
      resourceId,
      since: since ? new Date(since) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Delete()
  clear(
    @CurrentUser() userId: string,
    @Query('source') source: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.logs.clear(userId, source, resourceId);
  }
}
