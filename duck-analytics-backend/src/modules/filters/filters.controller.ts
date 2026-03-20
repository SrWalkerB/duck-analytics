import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FiltersService } from './filters.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CreateFilterDto } from './dto/create-filter.dto';
import type { UpdateFilterDto } from './dto/update-filter.dto';

@Controller('v1/dashboards/:dashboardId/filters')
@UseGuards(JwtAuthGuard)
export class FiltersController {
  constructor(private readonly service: FiltersService) {}

  @Get()
  findAll(@Param('dashboardId') dashboardId: string) {
    return this.service.findAllByDashboard(dashboardId);
  }

  @Post()
  create(@Param('dashboardId') dashboardId: string, @Body() dto: object) {
    return this.service.create(dashboardId, dto as CreateFilterDto);
  }

  @Put(':filterId')
  update(@Param('filterId') filterId: string, @Body() dto: object) {
    return this.service.update(filterId, dto as UpdateFilterDto);
  }

  @Delete(':filterId')
  remove(@Param('filterId') filterId: string) {
    return this.service.remove(filterId);
  }

  @Get(':filterId/values')
  getValues(
    @Param('filterId') filterId: string,
    @CurrentUser() userId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('search') search?: string,
    @Query('parentValue') parentValue?: string,
  ) {
    return this.service.getValues(filterId, userId, parseInt(page), parseInt(pageSize), search, parentValue);
  }
}
