import { OptimizationEngine } from "../optimizer/optimizationEngine";
import { ComponentAnalysis, AnalyzerConfig } from "../types";

describe("OptimizationEngine", () => {
  let engine: OptimizationEngine;
  const defaultConfig: AnalyzerConfig = {
    memoThreshold: {
      propsCount: 2,
      renderCount: 3,
    },
    performanceThreshold: {
      complexity: 5,
      arraySize: 100,
      computationWeight: 0.7,
    },
    ignorePatterns: [],
    customRules: [],
  };

  beforeEach(() => {
    engine = new OptimizationEngine(defaultConfig);
  });

  test("should suggest useMemo for expensive calculations", () => {
    const analysis: ComponentAnalysis = {
      name: "ExpensiveComponent",
      filePath: "src/components/ExpensiveComponent.tsx",
      props: [],
      hooks: [],
      complexity: {
        cyclomaticComplexity: 8,
        cognitiveComplexity: 6,
        linesOfCode: 50,
        dependencies: 2,
      },
      renderAnalysis: {
        estimatedRenderCount: 4,
        hasExpensiveCalculations: true,
        hasExpensiveOperations: true,
        affectedByStateChanges: true,
        eventHandlers: [],
        hasEventHandlers: false,
        hasChildComponents: false,
        memoizedComponents: [],
        functionPropPassing: false,
        hasStateUpdates: true,
      },
      dependencies: [],
      suggestions: [],
    };

    const suggestions = engine.generateSuggestions(analysis);

    // useMemo 제안이 있는지 확인
    expect(
      suggestions.some((s) => s.type === "useMemoForExpensiveCalculations")
    ).toBe(true);
  });

  test("should suggest useCallback for event handlers", () => {
    const analysis: ComponentAnalysis = {
      name: "EventComponent",
      filePath: "src/components/EventComponent.tsx",
      props: [],
      hooks: [],
      complexity: {
        cyclomaticComplexity: 3,
        cognitiveComplexity: 2,
        linesOfCode: 30,
        dependencies: 1,
      },
      renderAnalysis: {
        estimatedRenderCount: 5,
        hasExpensiveCalculations: false,
        hasExpensiveOperations: false,
        affectedByStateChanges: true,
        eventHandlers: [
          {
            name: "handleClick",
            type: "click",
            usesProps: true,
            usesState: true,
            hasCleanup: false,
          },
        ],
        hasEventHandlers: true,
        hasChildComponents: true,
        memoizedComponents: [],
        functionPropPassing: true,
        hasStateUpdates: true,
      },
      dependencies: [],
      suggestions: [],
    };

    const suggestions = engine.generateSuggestions(analysis);

    // useCallback 제안이 있는지 확인
    expect(
      suggestions.some((s) => s.type === "useCallbackForEventHandlers")
    ).toBe(true);
  });
});
