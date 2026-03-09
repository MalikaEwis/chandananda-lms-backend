import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { WorkflowQueryService } from './workflow-query.service';
import { WorkflowTaskService } from './workflow-task.service';
import { WorkflowsController } from './workflows.controller';

import { USER_SERVICE_CLIENT } from './constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplate,
      WorkflowStep,
      WorkflowInstance,
      WorkflowTask,
    ]),
    // TCP client to user-service — used for role-based auto-assignment
    ClientsModule.register([
      {
        name: USER_SERVICE_CLIENT,
        transport: Transport.TCP,
        options: { port: 4002, retryAttempts: 3, retryDelay: 1000 },
      },
    ]),
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowTemplatesService,
    WorkflowRuntimeService,
    WorkflowQueryService,
    WorkflowTaskService,
  ],
})
export class WorkflowsModule {}
