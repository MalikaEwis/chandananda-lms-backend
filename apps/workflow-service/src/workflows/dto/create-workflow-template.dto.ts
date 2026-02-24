import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StepType, WorkflowType } from '../enums';

export class CreateWorkflowStepDto {
  @IsString()
  @MinLength(1)
  stepName: string;

  @IsInt()
  @Min(1)
  stepOrder: number;

  @IsEnum(StepType)
  stepType: StepType;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsString()
  @IsOptional()
  requiredRole?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateWorkflowTemplateDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  templateCode: string;

  @IsEnum(WorkflowType)
  workflowType: WorkflowType;

  @IsString()
  @IsOptional()
  tenantDomain?: string;

  @IsInt()
  @IsOptional()
  schoolId?: number;

  @IsString()
  @IsOptional()
  module?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps: CreateWorkflowStepDto[];
}
