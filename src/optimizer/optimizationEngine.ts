import type {
  AnalyzerConfig,
  ComponentAnalysis,
  OptimizationSuggestion,
} from '../types';
import { defaultRules } from './rules/defaultRules';
import { calculateImpact } from '../utils/optimizerUtils';

export class OptimizationEngine {
  private config: AnalyzerConfig;
  private rules: any[];

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.rules = [...defaultRules, ...(config.customRules || [])];
  }

  public generateSuggestions(
    analysis: ComponentAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (const rule of this.rules) {
      if (rule.test(analysis)) {
        const optimizationType = rule.name; // 규칙 이름을 최적화 타입으로 사용

        suggestions.push({
          type: optimizationType,
          description: rule.suggestion(analysis),
          priority: rule.priority,
          impact: calculateImpact(rule, analysis),
          codeExample: this.generateCodeExample(optimizationType, analysis),
        });
      }
    }

    return this.prioritizeSuggestions(suggestions);
  }

  private prioritizeSuggestions(
    suggestions: OptimizationSuggestion[]
  ): OptimizationSuggestion[] {
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  private generateCodeExample(
    type: string,
    analysis: ComponentAnalysis
  ): string {
    const templates = this.getOptimizationTemplates();
    return templates[type]?.(analysis) || '';
  }

  private getOptimizationTemplates(): Record<
    string,
    (analysis: ComponentAnalysis) => string
  > {
    return {
      useMemoForExpensiveCalculations: (analysis) => `
const memoizedValue = useMemo(() => {
  // Expensive calculation for ${analysis.name}
  return expensiveOperation(dependencies);
}, [dependencies]);`,
      useCallbackForPropFunctions: (analysis) => `
const memoizedCallback = useCallback(() => {
  // Callback implementation for ${analysis.name}
}, [dependencies]);`,
      reactMemoForPureComponents: (analysis) => `
export default React.memo(${analysis.name});`,
    };
  }
}
