import { OptimizationRule, ComponentAnalysis } from '../../types';
import { HOOK_TYPES } from '../../utils/astUtils';

export const defaultRules: OptimizationRule[] = [
  // 1. useMemo 사용 제안 규칙
  {
    name: 'useMemoForExpensiveCalculations',
    description: 'Suggest using useMemo for expensive calculations',
    priority: 8,
    test: (analysis: ComponentAnalysis): boolean => {
      return (
        analysis.complexity.cyclomaticComplexity > 5 ||
        analysis.renderAnalysis.hasExpensiveCalculations ||
        analysis.renderAnalysis.hasExpensiveOperations
      );
    },
    suggestion: (analysis: ComponentAnalysis): string => {
      const complexity = analysis.complexity.cyclomaticComplexity;
      return `
Component "${analysis.name}" contains expensive calculations that could benefit from memoization.
- Cyclomatic Complexity: ${complexity}
- Has Expensive Operations: ${analysis.renderAnalysis.hasExpensiveOperations}

Consider using useMemo to avoid unnecessary recalculations:

\`\`\`typescript
const memoizedValue = useMemo(() => {
  // Move your expensive calculation here
  return expensiveOperation(dependencies);
}, [/* Add your dependencies here */]);
\`\`\`
      `;
    },
  },

  // 2. useCallback 사용 제안 규칙
  {
    name: 'useCallbackForEventHandlers',
    description: 'Suggest using useCallback for event handlers',
    priority: 7,
    test: (analysis: ComponentAnalysis): boolean => {
      return (
        analysis.renderAnalysis.hasEventHandlers &&
        (analysis.renderAnalysis.hasChildComponents ||
          analysis.props.some((p) => p.type === 'function'))
      );
    },
    suggestion: (analysis: ComponentAnalysis): string => {
      const handlers = analysis.renderAnalysis.eventHandlers;
      return `
Component "${analysis.name}" has event handlers that should be memoized:
${handlers.map((h) => `- ${h.name}`).join('\n')}

Consider using useCallback:

\`\`\`typescript
const ${handlers[0]?.name || 'handleEvent'} = useCallback((event) => {
  // Your event handling logic
}, [/* dependencies */]);
\`\`\``;
    },
  },

  // 3. React.memo 사용 제안 규칙
  {
    name: 'reactMemoForPureComponents',
    description: 'Suggest using React.memo for pure components',
    priority: 6,
    test: (analysis: ComponentAnalysis): boolean => {
      const hasMinimalStateOrEffects = analysis.hooks.length <= 1;
      const receivesProps = analysis.props.length > 0;
      const rerendersFrequently =
        analysis.renderAnalysis.estimatedRenderCount > 3;

      return hasMinimalStateOrEffects && receivesProps && rerendersFrequently;
    },
    suggestion: (analysis: ComponentAnalysis): string => {
      return `
Component "${analysis.name}" appears to be a good candidate for React.memo:
- Receives ${analysis.props.length} prop(s)
- Estimated render count: ${analysis.renderAnalysis.estimatedRenderCount}
- Minimal internal state/effects

Consider wrapping your component with React.memo:

\`\`\`typescript
export default React.memo(${analysis.name});
\`\`\`
      `;
    },
  },

  // 4. 의존성 배열 최적화 규칙
  {
    name: 'optimizeDependencyArrays',
    description: 'Suggest optimizing dependency arrays',
    priority: 5,
    test: (analysis: ComponentAnalysis): boolean => {
      return analysis.hooks.some(
        (hook) =>
          [HOOK_TYPES.EFFECT, HOOK_TYPES.MEMO, HOOK_TYPES.CALLBACK].includes(
            hook.type as any
          ) && hook.dependencies.length > 3
      );
    },
    suggestion: (analysis: ComponentAnalysis): string => {
      const hooksWithManyDeps = analysis.hooks.filter(
        (hook) => hook.dependencies.length > 3
      );

      return `
Component "${analysis.name}" has hooks with large dependency arrays:
${hooksWithManyDeps
  .map((h) => `- ${h.name}: ${h.dependencies.length} dependencies`)
  .join('\n')}

Consider:
1. Breaking down the hook into smaller ones
2. Using useReducer instead of multiple useState
3. Moving static values outside the component

Example:
\`\`\`typescript
// Before
useEffect(() => {
  // Effect with many dependencies
}, [dep1, dep2, dep3, dep4, dep5]);

// After
const staticValue = useMemo(() => computeStaticValue(), []);
useEffect(() => {
  // Effect with fewer dependencies
}, [staticValue]);
\`\`\`
      `;
    },
  },

  // 5. 불필요한 상태 업데이트 감지 규칙
  {
    name: 'preventUnnecessaryUpdates',
    description: 'Detect and prevent unnecessary state updates',
    priority: 7,
    test: (analysis: ComponentAnalysis): boolean => {
      return (
        analysis.renderAnalysis.hasStateUpdates &&
        analysis.renderAnalysis.estimatedRenderCount > 5
      );
    },
    suggestion: (analysis: ComponentAnalysis): string => {
      return `
Component "${analysis.name}" might have unnecessary state updates:
- High render count: ${analysis.renderAnalysis.estimatedRenderCount}
- Has state updates inside effects or callbacks

Consider:
1. Using state updater function to avoid stale closures
2. Batching multiple state updates
3. Moving state updates to useEffect when appropriate

Example:
\`\`\`typescript
// Before
const handleClick = () => {
  setCount(count + 1);
  setTotal(total + count);
};

// After
const handleClick = () => {
  setCount(prev => {
    const newCount = prev + 1;
    setTotal(total => total + newCount);
    return newCount;
  });
};
\`\`\`
      `;
    },
  },
];
