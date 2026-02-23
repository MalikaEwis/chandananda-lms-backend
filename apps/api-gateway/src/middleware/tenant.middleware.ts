import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantHeader = req.headers['x-tenant-domain'];

    let tenantDomain = 'cc.lk'; // Default for development

    if (tenantHeader && typeof tenantHeader === 'string') {
      tenantDomain = tenantHeader.trim().toLowerCase();
    }

    req.tenantDomain = tenantDomain;

    next();
  }
}
