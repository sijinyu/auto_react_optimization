import type { ComponentAnalysis } from '../../types';

export interface Rule {
  name: string;
  description: string;
  priority: number;
  test: (analysis: ComponentAnalysis) => boolean;
  suggestion: (analysis: ComponentAnalysis) => string;
}

export interface RuleContext {
  componentName: string;
  filePath: string;
  config: any;
}
