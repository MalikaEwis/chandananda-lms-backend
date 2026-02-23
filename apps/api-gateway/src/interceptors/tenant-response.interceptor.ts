import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class TenantResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const tenantDomain = request.tenantDomain || 'cc.lk';

    return next.handle().pipe(
      tap(() => {
        response.setHeader('x-tenant-domain', tenantDomain);
      }),
    );
  }
}
