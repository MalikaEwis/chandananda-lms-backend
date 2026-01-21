import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { MICROSERVICES_CLIENTS } from 'src/constants';
import { JwtAuthGuard } from 'src/auth/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(
    @Inject(MICROSERVICES_CLIENTS.USERS_SERVICE)
    private usersClient: ClientProxy,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return firstValueFrom(
      this.usersClient.send('users.findById', req.user.userId),
    );
  }
}
