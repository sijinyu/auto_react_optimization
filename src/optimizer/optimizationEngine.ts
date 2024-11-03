import {
  AnalyzerConfig,
  ComponentAnalysis,
  OptimizationSuggestion,
  Impact,
  OptimizationRule,
} from "../types";
import { defaultRules } from "./rules/defaultRules";
import { generateASTHash } from "../utils/astUtils";

export class OptimizationEngine {
  private processedComponents: Set<string> = new Set();
  private suggestionCache: Map<string, OptimizationSuggestion[]> = new Map();

  constructor(
    private config: AnalyzerConfig,
    private rules = [...defaultRules, ...(config.customRules || [])]
  ) {}

  public generateSuggestions(
    analysis: ComponentAnalysis
  ): OptimizationSuggestion[] {
    // 컴포넌트 중복 분석 방지
    const componentHash = this.generateComponentHash(analysis);
    if (this.processedComponents.has(componentHash)) {
      return this.suggestionCache.get(componentHash) || [];
    }

    try {
      const suggestions = this.analyzeSuggestions(analysis);

      // 캐시 업데이트
      this.processedComponents.add(componentHash);
      this.suggestionCache.set(componentHash, suggestions);

      return suggestions;
    } catch (error) {
      console.error(
        `Error generating suggestions for ${analysis.name}:`,
        error
      );
      return [];
    }
  }

  private analyzeSuggestions(
    analysis: ComponentAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (const rule of this.rules) {
      try {
        if (this.shouldSkipRule(rule, analysis)) continue;

        if (rule.test(analysis)) {
          const impact = this.calculateImpact(rule, analysis);
          suggestions.push({
            type: rule.name,
            description: rule.suggestion(analysis),
            priority: this.calculatePriority(rule, analysis),
            impact,
            codeExample: this.generateCodeExample(rule, analysis),
          });
        }
      } catch (error) {
        console.error(`Error applying rule ${rule.name}:`, error);
      }
    }

    return this.prioritizeSuggestions(suggestions);
  }

  private shouldSkipRule(
    rule: OptimizationRule,
    analysis: ComponentAnalysis
  ): boolean {
    // 이미 적용된 최적화는 건너뛰기
    if (this.isOptimizationAlreadyApplied(rule, analysis)) {
      return true;
    }

    // 설정에서 무시하도록 지정된 패턴 체크
    const ignorePatterns = this.config.ignorePatterns || [];
    return ignorePatterns.some((pattern) =>
      new RegExp(pattern).test(analysis.filePath)
    );
  }

  private isOptimizationAlreadyApplied(
    rule: OptimizationRule,
    analysis: ComponentAnalysis
  ): boolean {
    switch (rule.name) {
      case "useMemoForExpensiveCalculations":
        return this.hasMemoization(analysis);
      case "useCallbackForEventHandlers":
        return this.hasCallbackOptimization(analysis);
      case "reactMemoForPureComponents":
        return this.isMemoized(analysis);
      default:
        return false;
    }
  }

  private hasMemoization(analysis: ComponentAnalysis): boolean {
    return analysis.hooks.some((hook) => hook.type === "useMemo");
  }

  private hasCallbackOptimization(analysis: ComponentAnalysis): boolean {
    return analysis.hooks.some((hook) => hook.type === "useCallback");
  }

  private isMemoized(analysis: ComponentAnalysis): boolean {
    return analysis.renderAnalysis.memoizedComponents.some(
      (comp) => comp.name === analysis.name
    );
  }

  private calculateImpact(
    rule: OptimizationRule,
    analysis: ComponentAnalysis
  ): Impact {
    const baseImpact = {
      renderTimeImprovement: 0,
      memoryImprovement: 0,
      bundleSizeImpact: 0,
    };

    // 렌더링 시간 개선 추정
    if (analysis.complexity.cyclomaticComplexity > 5) {
      baseImpact.renderTimeImprovement += 0.2;
    }
    if (analysis.renderAnalysis.hasExpensiveCalculations) {
      baseImpact.renderTimeImprovement += 0.3;
    }

    // 메모리 사용 개선 추정
    if (analysis.renderAnalysis.estimatedRenderCount > 3) {
      baseImpact.memoryImprovement += 0.2;
    }
    if (analysis.renderAnalysis.hasExpensiveOperations) {
      baseImpact.memoryImprovement += 0.2;
    }

    // 번들 크기 영향 추정
    baseImpact.bundleSizeImpact += 0.01; // 최적화 코드 추가로 인한 영향

    return this.normalizeImpact(baseImpact);
  }

  private normalizeImpact(impact: Impact): Impact {
    return {
      renderTimeImprovement: Math.min(
        Math.max(impact.renderTimeImprovement, 0),
        1
      ),
      memoryImprovement: Math.min(Math.max(impact.memoryImprovement, 0), 1),
      bundleSizeImpact: Math.min(Math.max(impact.bundleSizeImpact, 0), 1),
    };
  }

  private calculatePriority(
    rule: OptimizationRule,
    analysis: ComponentAnalysis
  ): number {
    let priority = rule.priority;

    // 렌더링 빈도에 따른 가중치
    if (analysis.renderAnalysis.estimatedRenderCount > 5) {
      priority += 2;
    }

    // 복잡도에 따른 가중치
    if (analysis.complexity.cyclomaticComplexity > 8) {
      priority += 2;
    }

    // 자식 컴포넌트 영향도에 따른 가중치
    if (analysis.renderAnalysis.hasChildComponents) {
      priority += 1;
    }

    return Math.min(Math.max(priority, 1), 10);
  }

  private generateCodeExample(
    rule: OptimizationRule,
    analysis: ComponentAnalysis
  ): string {
    const templates = this.getOptimizationTemplates();
    return templates[rule.name]?.(analysis) || "";
  }

  private prioritizeSuggestions(
    suggestions: OptimizationSuggestion[]
  ): OptimizationSuggestion[] {
    return suggestions.sort((a, b) => {
      // 우선순위 비교
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // 영향도 비교
      return (
        b.impact.renderTimeImprovement +
        b.impact.memoryImprovement -
        (a.impact.renderTimeImprovement + a.impact.memoryImprovement)
      );
    });
  }

  private generateComponentHash(analysis: ComponentAnalysis): string {
    return generateASTHash({
      type: "Component",
      name: analysis.name,
      path: analysis.filePath,
    } as any);
  }

  private getOptimizationTemplates(): Record<
    string,
    (analysis: ComponentAnalysis) => string
  > {
    return {
      useMemoForExpensiveCalculations: (analysis) => `
const memoizedValue = useMemo(() => {
  // Expensive calculation from ${analysis.name}
  return expensiveOperation(dependencies);
}, [dependencies]);`,

      useCallbackForEventHandlers: (analysis) => `
const handleEvent = useCallback((event) => {
  // Event handler from ${analysis.name}
}, [dependencies]);`,

      reactMemoForPureComponents: (analysis) => `
export default React.memo(${analysis.name});`,

      optimizeDependencyArrays: (analysis) => `
// Original hook in ${analysis.name}
useEffect(() => {
  // Effect logic
}, [dep1, dep2, dep3]);

// Optimized version
const memoizedValue = useMemo(() => computeValue(dep1, dep2), [dep1, dep2]);
useEffect(() => {
  // Effect logic with fewer dependencies
}, [memoizedValue]);`,
    };
  }
}
