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
import { QueriesService } from './queries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CreateQueryDto } from './dto/create-query.dto';
import type { UpdateQueryDto } from './dto/update-query.dto';
import type { PreviewQueryDto } from './dto/preview-query.dto';

@Controller('v1/queries')
@UseGuards(JwtAuthGuard)
export class QueriesController {
  constructor(private readonly service: QueriesService) {}

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
    return this.service.create(userId, dto as CreateQueryDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @CurrentUser() userId: string, @Body() dto: object) {
    return this.service.update(id, userId, dto as UpdateQueryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.execute(id, userId);
  }

  @Post('preview')
  preview(@CurrentUser() userId: string, @Body() dto: object) {
    return this.service.preview(userId, dto as PreviewQueryDto);
  }
}
