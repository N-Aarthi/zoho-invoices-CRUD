import { Test, TestingModule } from '@nestjs/testing';
import { ZohoInvoicesController } from './zoho-invoices.controller';

describe('ZohoInvoicesController', () => {
  let controller: ZohoInvoicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZohoInvoicesController],
    }).compile();

    controller = module.get<ZohoInvoicesController>(ZohoInvoicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
