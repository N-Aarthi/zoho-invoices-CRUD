import { Controller, Get, Query, Res, BadRequestException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import axios from 'axios';

@Controller('zoho-invoices')
export class ZohoInvoicesController {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private accessToken: string;
  private organizationId: string; 

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET');
    this.redirectUri = this.configService.get<string>('ZOHO_REDIRECT_URI');
  }

  @Get('authorize')
  async redirectToAuth(@Res() res: Response) {
    const authUrl = `https://accounts.zoho.in/oauth/v2/auth?scope=ZohoInvoice.fullaccess.all&client_id=${this.clientId}&state=testing&response_type=code&redirect_uri=${this.redirectUri}&access_type=offline&prompt=consent`;
    return res.redirect(authUrl);
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Authorization code is required' });
    }

    try {
      const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
        params: {
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code,
        },
      });

      this.accessToken = response.data.access_token;
      const refreshToken = response.data.refresh_token;

      // Dynamically fetch the organization ID
      const orgResponse = await axios.get('https://invoice.zoho.in/api/v3/organizations', {
        headers: { Authorization: `Zoho-oauthtoken ${this.accessToken}` },
      });
      this.organizationId = orgResponse.data.organizations[0].organization_id;

      res.status(HttpStatus.OK).json({
        accessToken: this.accessToken,
        refreshToken,
        organizationId: this.organizationId, // Returning the organizationId for reference
      });
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

// -------------Contacts/Customers Operations

@Get('contacts')
async handleContactOperations(@Query() query: any, @Res() res: Response): Promise<void> {
  const { action, contact_id, contact_name, ...rest } = query;

  if (!this.accessToken) {
    throw new BadRequestException('Access token not found. Authorize the app first.');
  }

  try {
    let response;

    const apiUrl = 'https://invoice.zoho.in/api/v3/contacts';
    const config = {
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
      },
      params: {
        organization_id: this.organizationId,
        ...rest,
      },
    };

    switch (action) {
      case 'list':
        response = await axios.get(apiUrl, config);
        break;

      case 'create':
        if (!contact_name) throw new BadRequestException('Missing "contact_name" parameter for create');
        response = await axios.post(apiUrl, {
          contact_name,
          ...rest,
        }, config);
        break;

      case 'update':
        if (!contact_id) throw new BadRequestException('Missing "contact_id" parameter for update');
        if (!contact_name) throw new BadRequestException('Missing "contact_name" parameter for update');
        response = await axios.put(`${apiUrl}/${contact_id}`, {
          contact_name,
          ...rest,
        }, config);
        break;

      case 'delete':
        if (!contact_id) throw new BadRequestException('Missing "contact_id" parameter for delete');
        response = await axios.delete(`${apiUrl}/${contact_id}`, config);
        break;

      case 'get':
        if (!contact_id) throw new BadRequestException('Missing "contact_id" parameter for get');
        response = await axios.get(`${apiUrl}/${contact_id}`, config);
        break;

      default:
        throw new BadRequestException('Invalid "action" parameter');
    }

    res.status(HttpStatus.OK).json(response.data);
  } catch (error) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}



//--------------Estimates Operations

@Get('estimates')
  async handleEstimateOperations(@Query() query: any, @Res() res: Response): Promise<void> {
    const { action, estimate_id, customer_id, line_items, custom_fields, ...rest } = query;

    if (!this.accessToken) {
      throw new BadRequestException('Access token not found. Authorize the app first.');
    }

    try {
      let response;

      const apiUrl = 'https://invoice.zoho.in/api/v3/estimates';
      const config = {
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        },
        params: {
          organization_id: this.organizationId, // Use the dynamically set organization ID
          ...rest,
        },
      };

      switch (action) {
        case 'list':
          response = await axios.get(apiUrl, config);
          break;

        case 'create':
          if (!customer_id || !line_items) throw new BadRequestException('Missing required parameters for create');
          response = await axios.post(apiUrl, {
            customer_id,
            line_items: JSON.parse(line_items || '[]'), // Parsing line_items if provided
            ...rest,
          }, config);
          break;

        case 'update':
          if (!estimate_id) throw new BadRequestException('Missing "estimate_id" parameter for update');
          if (!customer_id || !custom_fields) throw new BadRequestException('Missing required parameters for update');
          response = await axios.put(`${apiUrl}/${estimate_id}`, {
            customer_id,
            custom_fields: JSON.parse(custom_fields || '[]'),
            line_items: JSON.parse(line_items || '[]'),
            ...rest,
          }, config);
          break;      


        case 'delete':
          if (!estimate_id) throw new BadRequestException('Missing "estimate_id" parameter for delete');
          response = await axios.delete(`${apiUrl}/${estimate_id}`, config);
          break;

        case 'get':
          if (!estimate_id) throw new BadRequestException('Missing "estimate_id" parameter for get');
          response = await axios.get(`${apiUrl}/${estimate_id}`, config);
          break;

        default:
          throw new BadRequestException('Invalid "action" parameter');
      }

      res.status(HttpStatus.OK).json(response.data);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }



// -------------------Customer Payments

@Get('customer-payments')
  async handleCustomerPaymentOperations(@Query() query: any, @Res() res: Response): Promise<void> {
    const { action, payment_id, customer_id, payment_mode, amount, date, invoices, ...rest } = query;

    if (!this.accessToken) {
      throw new BadRequestException('Access token not found. Authorize the app first.');
    }

    try {
      let response;

      const apiUrl = 'https://invoice.zoho.in/api/v3/customerpayments';
      const config = {
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        },
        params: {
          organization_id: this.organizationId, // Use the dynamically set organization ID
          ...rest,
        },
      };

      switch (action) {
        case 'list':
          response = await axios.get(apiUrl, config);
          break;

          case 'create':
            if (!customer_id || !payment_mode || !amount || !date || !invoices) {
                throw new BadRequestException('Missing required parameters for create');
            }
            response = await axios.post(apiUrl, {
                customer_id,
                payment_mode,
                amount,
                date,
                invoices: JSON.parse(invoices || '[]'), // Parsing invoices if provided
            }, config);
            break;
        
        case 'update':
            if (!payment_id) throw new BadRequestException('Missing "payment_id" parameter for update');
            if (!customer_id || !payment_mode || !amount || !date || !invoices) {
                throw new BadRequestException('Missing required parameters for update');
            }
            response = await axios.put(`${apiUrl}/${payment_id}`, {
                customer_id,
                payment_mode,
                amount,
                date,
                invoices: JSON.parse(invoices || '[]'),
            }, config);
            break;
        

        case 'delete':
          if (!payment_id) throw new BadRequestException('Missing "payment_id" parameter for delete');
          response = await axios.delete(`${apiUrl}/${payment_id}`, config);
          break;

        case 'get':
          if (!payment_id) throw new BadRequestException('Missing "payment_id" parameter for get');
          response = await axios.get(`${apiUrl}/${payment_id}`, config);
          break;

        default:
          throw new BadRequestException('Invalid "action" parameter');
      }

      res.status(HttpStatus.OK).json(response.data);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }



  // --------------------Expenses


  @Get('expenses')
  async handleExpenseOperations(@Query() query: any, @Res() res: Response): Promise<void> {
    const {
      action, id, customer_id, date, reference_number, amount, line_items, ...rest
    } = query;

    if (!this.accessToken) {
      throw new BadRequestException('Access token not found. Authorize the app first.');
    }

    try {
      let response;

      const apiUrl = 'https://invoice.zoho.in/api/v3/expenses';
      const config = {
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        },
        params: {
          organization_id: this.organizationId, // Use the dynamically set organization ID
          ...rest,
        },
      };

      switch (action) {
        case 'list':
          response = await axios.get(apiUrl, config);
          break;

        case 'create':
          if (!amount || !reference_number || !date) {
            throw new BadRequestException('Missing required parameters for create');
          }
          response = await axios.post(apiUrl, {
            amount,
            reference_number,
            date,
            line_items: JSON.parse(line_items || '[]'), // Parsing line_items if provided
            ...rest,
          }, config);
          break;

        case 'update':
          if (!id) throw new BadRequestException('Missing "id" parameter for update');
          if (!date || !line_items) {
            throw new BadRequestException('Missing required parameters for update');
          }
          response = await axios.put(`${apiUrl}/${id}`, {
            date,
            line_items: JSON.parse(line_items || '[]'),
            ...rest,
          }, config);
          break;

        case 'delete':
          if (!id) throw new BadRequestException('Missing "id" parameter for delete');
          response = await axios.delete(`${apiUrl}/${id}`, config);
          break;

        case 'get':
          if (!id) throw new BadRequestException('Missing "id" parameter for get');
          response = await axios.get(`${apiUrl}/${id}`, config);
          break;

        default:
          throw new BadRequestException('Invalid "action" parameter');
      }

      res.status(HttpStatus.OK).json(response.data);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }


  //-----------------Projects


  @Get('projects')
  async handleProjectOperations(@Query() query: any, @Res() res: Response): Promise<void> {
    const {
      action, id, project_name, customer_id, estimate_id, billing_type, user_id, tasks, users, ...rest
    } = query;

    if (!this.accessToken) {
      throw new BadRequestException('Access token not found. Authorize the app first.');
    }

    try {
      let response;

      const apiUrl = 'https://invoice.zoho.in/api/v3/projects';
      const config = {
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        },
        params: {
          organization_id: this.organizationId, // Use the dynamically set organization ID
          ...rest,
        },
      };

      switch (action) {
        case 'list':
          response = await axios.get(apiUrl, config);
          break;

        case 'create':
          if (!project_name || !customer_id || !billing_type || !user_id) {
            throw new BadRequestException('Missing required parameters for create');
          }
          response = await axios.post(apiUrl, {
            project_name,
            customer_id,
            billing_type,
            user_id,
            tasks: JSON.parse(tasks || '[]'), // Parsing tasks if provided
            users: JSON.parse(users || '[]'), // Parsing users if provided
            ...rest,
          }, config);
          break;

        case 'update':
          if (!id) throw new BadRequestException('Missing "id" parameter for update');
          if (!project_name || !customer_id || !billing_type || !user_id) {
            throw new BadRequestException('Missing required parameters for update');
          }
          response = await axios.put(`${apiUrl}/${id}`, {
            project_name,
            customer_id,
            billing_type,
            user_id,
            tasks: JSON.parse(tasks || '[]'),
            users: JSON.parse(users || '[]'),
            ...rest,
          }, config);
          break;

        case 'delete':
          if (!id) throw new BadRequestException('Missing "id" parameter for delete');
          response = await axios.delete(`${apiUrl}/${id}`, config);
          break;

        case 'get':
          if (!id) throw new BadRequestException('Missing "id" parameter for get');
          response = await axios.get(`${apiUrl}/${id}`, config);
          break;

        default:
          throw new BadRequestException('Invalid "action" parameter');
      }

      res.status(HttpStatus.OK).json(response.data);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }


// -------------Invoices Operations

  @Get('invoices')
  async handleInvoiceOperations(@Query() query: any, @Res() res: Response): Promise<void> {
    const { action, id, customer_id, date, item_id, rate, quantity, description, line_items, ...rest } = query;

    if (!this.accessToken) {
      throw new BadRequestException('Access token not found. Authorize the app first.');
    }

    try {
      let response;

      const apiUrl = 'https://invoice.zoho.in/api/v3/invoices';
      const config = {
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        },
        params: {
          organization_id: this.organizationId, // Use the dynamically set organization ID
          ...rest,
        },
      };

      switch (action) {
        case 'list':
          response = await axios.get(apiUrl, config);
          break;

        case 'create':
          response = await axios.post(apiUrl, {
            customer_id,
            date,
            line_items: JSON.parse(line_items || '[]'), // Parsing line_items if provided
            ...rest,
          }, config);
          break;

        case 'update':
          if (!id) throw new BadRequestException('Missing "id" parameter for update');
          response = await axios.put(`${apiUrl}/${id}`, {
            customer_id,
            line_items: JSON.parse(line_items || '[]'),
            ...rest,
          }, config);
          break;

        case 'delete':
          if (!id) throw new BadRequestException('Missing "id" parameter for delete');
          response = await axios.delete(`${apiUrl}/${id}`, config);
          break;

        case 'get':
          if (!id) throw new BadRequestException('Missing "id" parameter for get');
          response = await axios.get(`${apiUrl}/${id}`, config);
          break;

        default:
          throw new BadRequestException('Invalid "action" parameter');
      }

      res.status(HttpStatus.OK).json(response.data);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }
}






