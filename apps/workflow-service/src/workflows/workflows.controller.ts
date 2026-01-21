import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller('workflows')
export class WorkflowsController {
  @MessagePattern('get_workflow')
  getWorkflow(id: number) {
    return { id, name: 'Workflow 1' };
  }
}
