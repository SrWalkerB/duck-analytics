import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CreateDashboardDto } from './dto/create-dashboard.dto';
import type { UpdateDashboardDto } from './dto/update-dashboard.dto';
import type { AddDashboardComponentDto } from './dto/add-dashboard-component.dto';
import type { UpdateLayoutDto } from './dto/update-layout.dto';

@Controller('v1/dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardsController {
  constructor(private readonly service: DashboardsService) {}

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.findOne(id, userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: object) {
    return this.service.create(userId, dto as CreateDashboardDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.update(id, userId, dto as UpdateDashboardDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/components')
  addComponent(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.addComponent(
      id,
      userId,
      dto as AddDashboardComponentDto,
    );
  }

  @Delete(':id/components/:dcId')
  removeComponent(
    @Param('id') id: string,
    @Param('dcId') dcId: string,
    @CurrentUser() userId: string,
  ) {
    return this.service.removeComponent(id, dcId, userId);
  }

  @Put(':id/layout')
  updateLayout(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.updateLayout(id, userId, dto as UpdateLayoutDto);
  }

  @Get(':id/data')
  getData(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.getData(id, userId);
  }

  @Post(':id/data')
  getDataFiltered(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    const activeFilters =
      (dto as { activeFilters?: Record<string, unknown[]> }).activeFilters ?? {};
    return this.service.getData(id, userId, activeFilters);
  }
}
