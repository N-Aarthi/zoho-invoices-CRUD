import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZohoInvoicesController } from './zoho-invoices/zoho-invoices.controller';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(), // Load environment variables from .env file
  ],
  controllers: [
    ZohoInvoicesController, // Include the ZohoInvoicesController
  ],
  providers: [
    ConfigService, // Inject configuration values
  ],
})
export class AppModule {}

