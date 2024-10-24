import { OptimizationEngine } from '../optimizer/optimizationEngine';
import { ComponentAnalysis } from '../types';

describe('Optimization Engine', () => {
  it('should suggest React.memo for pure components', () => {
    const engine = new OptimizationEngine({
      memoThreshold: { propsCount: 2, renderCount: 3 },
      performanceThreshold: {
        complexity: 5,
        arraySize: 100,
        computationWeight: 0.7,
      },
      ignorePatterns: [],
      customRules: [],
    });

    const analysis = {
      name: 'PureComponent',
      filePath: 'test.tsx',
      props: [
        {
          name: 'name',
          type: 'string',
          usageCount: 1,
          isRequired: true,
          updates: 0,
        },
        {
          name: 'age',
          type: 'number',
          usageCount: 1,
          isRequired: true,
          updates: 0,
        },
      ],
      hooks: [],
      complexity: {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        linesOfCode: 10,
        dependencies: 0,
      },
      renderAnalysis: {
        estimatedRenderCount: 1,
        hasExpensiveCalculations: false,
        hasExpensiveOperations: false,
        affectedByStateChanges: false,
        eventHandlers: [
          {
            name: 'test',
            type: 'click',
            usesProps: true,
            usesState: true,
          },
        ],
        hasEventHandlers: true,
        hasChildComponents: true,
        memoizedComponents: [
          {
            name: '213',
            isMemoized: false,
            receivedFunctions: [],
          },
        ],
        functionPropPassing: true,
        hasStateUpdates: true,
      },
      dependencies: [],
      suggestions: [],
    } as ComponentAnalysis;

    const suggestions = engine.generateSuggestions(analysis);
    expect(
      suggestions.some((s) => s.type === 'reactMemoForPureComponents')
    ).toBe(false);
  });
});
