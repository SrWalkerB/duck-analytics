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
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';

@Controller('v1/folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly service: FoldersService) {}

  @Get('tree')
  getTree(@CurrentUser() userId: string) {
    return this.service.getTree(userId);
  }

  @Get('root/contents')
  getRootContents(@CurrentUser() userId: string) {
    return this.service.getContents(null, userId);
  }

  @Get(':id/contents')
  getContents(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.getContents(id, userId);
  }

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.service.findAll(userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: object) {
    return this.service.create(userId, dto as CreateFolderDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: object,
  ) {
    return this.service.update(id, userId, dto as UpdateFolderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/move')
  move(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() body: object,
  ) {
    return this.service.move(
      id,
      userId,
      (body as { parentId: string | null }).parentId,
    );
  }
}
