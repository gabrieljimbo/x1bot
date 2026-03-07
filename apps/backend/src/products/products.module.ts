import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ApiConfigsModule } from '../api-configs/api-configs.module';

@Module({
  imports: [ApiConfigsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
