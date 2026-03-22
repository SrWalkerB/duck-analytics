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
import { ComponentsService } from './components.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CreateComponentDto } from './dto/create-component.dto';
import type { UpdateComponentDto } from './dto/update-component.dto';

@Controller('v1/components')
@UseGuards(JwtAuthGuard)
export class ComponentsController {
  constructor(private readonly service: ComponentsService) {}

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
    return this.service.create(userId, dto as CreateComponentDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.update(id, userId, dto as UpdateComponentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.duplicate(id, userId);
  }

  @Get(':id/data')
  getData(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.getData(id, userId);
  }
}
