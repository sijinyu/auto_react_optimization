import { ComponentAnalysis, OptimizationRule } from '../../types';

export const defaultRules: OptimizationRule[] = [
  // 1. useMemo 사용 제안 규칙
  {
    name: 'useMemoForExpensiveCalculations',
    description: 'Suggest using useMemo for expensive calculations',
    priority: 8,
    test: (analysis: ComponentAnalysis): boolean => {
      const hasOptimizedHandlers = analysis.hooks.some(
        (hook) => hook.type === 'useCallback' && hook.wrappedFunction
      );

      return (
        !hasOptimizedHandlers && // useCallback이 이미 있으면 제외
        (analysis.complexity.cyclomaticComplexity > 5 ||
          analysis.renderAnalysis.hasExpensiveCalculations ||
          analysis.renderAnalysis.hasExpensiveOperations)
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
      let checkBooles: boolean[] = [];
      // 1. props로 받은 함수 타입 분석
      const propsFunctions = analysis.props.filter(
        ({ type }) => type === 'function'
      );

      if (propsFunctions.length > 0) {
        propsFunctions.forEach(({ name: propName }) => {
          // 해당 props 함수가 사용되는 모든 위치 찾기
          const usages = analysis.renderAnalysis.eventHandlers.filter(
            (handler) => {
              // 핸들러 내부에서 props 함수 사용 여부 체크
              const handlerBody = handler.name; // 실제로는 함수 본문을 분석해야 함
              return !handlerBody.includes(propName);
            }
          );
          usages.forEach((usage) => {
            // 재가공된 함수인 경우 useCallback 확인
            const isWrappedWithCallback = analysis.hooks.some(
              (hook) =>
                hook.type === 'useCallback' &&
                hook.wrappedFunction === usage.name
            );
            if (!isWrappedWithCallback) {
              checkBooles.push(true);
            }
          });
        });
      }

      // 2. 컴포넌트 내부에서 선언된 모든 함수 검사
      const internalHandlers = analysis.renderAnalysis.eventHandlers.filter(
        (handler) => !propsFunctions.some((prop) => prop.name === handler.name)
      );
      // useCallback으로 감싸진 함수 이름들 목록
      const callbackWrappedFunctions = analysis.hooks
        .filter((hook) => hook.type === 'useCallback')
        .map((hook) => hook.wrappedFunction)
        .filter((name): name is string => name !== undefined);

      internalHandlers.forEach((handler) => {
        // handler.name이 useCallback으로 감싸진 함수 목록에 있는지 확인
        if (!callbackWrappedFunctions.includes(handler.name)) {
          checkBooles.push(true);
        }
      });
      return checkBooles.length > 0;
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
];
