import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Example controller showing how to access tenant context
 *
 * The tenantDomain is automatically extracted from the x-tenant-domain header
 * and attached to every request by the TenantMiddleware.
 */
@Controller('example')
export class ExampleController {
  @Get()
  exampleEndpoint(@Req() req: Request) {
    // Access the tenant domain from the request
    const tenantDomain = req.tenantDomain; // e.g., "school1.edu" or "cc.lk" (default)

    return {
      message: 'Tenant context is available',
      tenant: tenantDomain,
    };
  }
}
