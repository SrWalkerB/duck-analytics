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
import { DataSourcesService } from './data-sources.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CreateDataSourceDto } from './dto/create-data-source.dto';
import type { UpdateDataSourceDto } from './dto/update-data-source.dto';

@Controller('v1/data-sources')
@UseGuards(JwtAuthGuard)
export class DataSourcesController {
  constructor(private readonly service: DataSourcesService) {}

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
    return this.service.create(userId, dto as CreateDataSourceDto);
  }

  @Post('test-connection')
  testRawConnection(@Body() dto: object) {
    const { connectionString, database, type } = (dto ?? {}) as {
      connectionString: string;
      database: string;
      type?: string;
    };
    return this.service.testRawConnection(connectionString, database, type);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.update(id, userId, dto as UpdateDataSourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/test')
  testConnection(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    const { connectionString, database } = (dto ?? {}) as {
      connectionString?: string;
      database?: string;
    };
    return this.service.testConnection(id, userId, {
      connectionString,
      database,
    });
  }

  @Get(':id/collections')
  getCollections(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.getCollections(id, userId);
  }

  @Get(':id/collections/:name/schema')
  getCollectionSchema(
    @Param('id') id: string,
    @Param('name') name: string,
    @CurrentUser() userId: string,
  ) {
    return this.service.getCollectionSchema(id, name, userId);
  }
}
