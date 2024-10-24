import type { OptimizationRule, ComponentAnalysis } from '../../types';
import {
  generateCallbackExample,
  getFunctionDetails,
  getMemoizedComponentDetails,
  hasChildComponents,
  hasEventHandlers,
  hasFunctionPropPassing,
  hasFunctionProps,
  hasReactMemoComponents,
} from '../../utils';

export const defaultRules: OptimizationRule[] = [
  {
    name: 'useMemoForExpensiveCalculations',
    description: 'Suggest using useMemo for expensive calculations',
    priority: 5,
    test: (analysis: ComponentAnalysis) => {
      return (
        analysis.complexity.cyclomaticComplexity > 10 ||
        analysis.renderAnalysis.hasExpensiveCalculations ||
        analysis.renderAnalysis.hasExpensiveOperations
      );
    },
    suggestion: (analysis: ComponentAnalysis) => {
      const improvementEstimate = analysis.complexity.cyclomaticComplexity * 5; // 예상 성능 향상도 계산

      return `
Consider using useMemo for expensive calculations in ${analysis.name}.
This could improve performance by avoiding unnecessary recalculations.
Estimated performance improvement: ${improvementEstimate}%

Example:
const memoizedValue = useMemo(() => {
  // Your expensive calculation
  return expensiveOperation(dependencies);
}, [dependencies]);`;
    },
  },
  {
    name: 'useCallbackForEventHandlers',
    description: 'Suggest using useCallback for event handlers and callbacks',
    priority: 4,
    test: (analysis: ComponentAnalysis) => {
      return (
        hasFunctionProps(analysis) || // 함수형 props가 있는 경우
        hasEventHandlers(analysis) || // 이벤트 핸들러가 있는 경우
        hasChildComponents(analysis) // 자식 컴포넌트에 함수를 전달하는 경우
      );
    },
    suggestion: (analysis: ComponentAnalysis) => {
      const functionDetails = getFunctionDetails(analysis);

      return `
Consider using useCallback for the following functions in ${analysis.name}:
${functionDetails.map((detail) => `- ${detail}`).join('\n')}

Example:
const handleEvent = useCallback((params) => {
  // Your event handling logic
  ${generateCallbackExample(analysis)}
}, [/* Add your dependencies here */]);

Benefits:
- Prevents unnecessary re-renders of child components
- Maintains referential equality between renders
- Optimizes performance for event handlers used in lists`;
    },
  },
  {
    name: 'useCallbackForMemoizedComponents',
    description: 'Suggest using useCallback with memoized child components',
    priority: 4,
    test: (analysis: ComponentAnalysis) => {
      return (
        hasReactMemoComponents(analysis) && // React.memo 사용하는 자식 컴포넌트가 있고
        hasFunctionPropPassing(analysis) // 그 컴포넌트에 함수를 전달하는 경우
      );
    },
    suggestion: (analysis: ComponentAnalysis) => {
      const memoizedComponents = getMemoizedComponentDetails(analysis);

      return `
Your component ${analysis.name} passes functions to memoized components:
${memoizedComponents.map((comp) => `- ${comp}`).join('\n')}

To fully benefit from React.memo, wrap the callback functions with useCallback:

Example:
const handleCallback = useCallback((params) => {
  // Your callback logic
}, [/* dependencies */]);

<MemoizedChildComponent onAction={handleCallback} />`;
    },
  },
];
