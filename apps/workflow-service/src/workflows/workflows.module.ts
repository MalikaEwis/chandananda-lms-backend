import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTask } from './entities/workflow-task.entity';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { WorkflowQueryService } from './workflow-query.service';
import { WorkflowTaskService } from './workflow-task.service';
import { WorkflowsController } from './workflows.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplate,
      WorkflowStep,
      WorkflowInstance,
      WorkflowTask,
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
