import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkflowsController } from './workflows/workflows.controller';

@Module({
  imports: [],
  controllers: [AppController, WorkflowsController],
  providers: [AppService],
})
export class AppModule {}
