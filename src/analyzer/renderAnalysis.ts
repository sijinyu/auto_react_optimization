import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type {
  AnalyzerConfig,
  ChildComponent,
  EventHandler,
  RenderAnalysis,
} from '../types';
import {
  analyzeEventHandler,
  analyzeFunctionProps,
  getMemoComponentName,
  isComponentName,
  isMemoCall,
} from '../utils';

export function analyzeRenderingBehavior(
  path: NodePath,
  config: AnalyzerConfig
): RenderAnalysis {
  const eventHandlers: EventHandler[] = [];
  const memoizedComponents: ChildComponent[] = [];
  let hasEventHandlers = false;
  let hasChildComponents = false;
  let functionPropPassing = false;
  let hasStateUpdates = false;

  // JSX 요소와 이벤트 핸들러 분석
  path.traverse({
    // 이벤트 핸들러 분석
    JSXAttribute(attributePath) {
      const name = attributePath.node.name;
      if (t.isJSXIdentifier(name) && name.name.startsWith('on')) {
        hasEventHandlers = true;

        const value = attributePath.node.value;
        if (
          t.isJSXExpressionContainer(value) &&
          t.isIdentifier(value.expression)
        ) {
          const handlerName = value.expression.name;
          const handler = analyzeEventHandler(path, handlerName);
          if (handler) {
            eventHandlers.push(handler);
          }
        }
      }
    },

    // 자식 컴포넌트 분석
    JSXOpeningElement(elementPath) {
      const tagName = elementPath.node.name;
      if (t.isJSXIdentifier(tagName) && isComponentName(tagName.name)) {
        hasChildComponents = true;
        analyzeFunctionProps(elementPath, memoizedComponents);
      }
    },

    // 상태 업데이트 분석
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isIdentifier(callee) && callee.name.startsWith('set')) {
        hasStateUpdates = true;
      }
      if (isMemoCall(callPath)) {
        const componentName = getMemoComponentName(callPath);
        if (componentName) {
          memoizedComponents.push({
            name: componentName,
            isMemoized: true,
            receivedFunctions: [],
          });
        }
      }
    },
  });

  return {
    estimatedRenderCount: calculateEstimatedRenderCount(path),
    hasExpensiveCalculations: checkForExpensiveCalculations(path, config),
    hasExpensiveOperations: checkForExpensiveOperations(path),
    affectedByStateChanges: checkForStateChanges(path),
    eventHandlers,
    hasEventHandlers,
    hasChildComponents,
    memoizedComponents,
    functionPropPassing,
    hasStateUpdates,
  };
}

function calculateEstimatedRenderCount(path: NodePath): number {
  let count = 1; // 기본 렌더링

  path.traverse({
    CallExpression(callPath) {
      if (isStateUpdate(callPath) || isEffectHook(callPath)) {
        count++;
      }
    },
  });

  return count;
}

function checkForExpensiveCalculations(
  path: NodePath,
  config: AnalyzerConfig
): boolean {
  let found = false;

  path.traverse({
    ForStatement(forPath) {
      const complexity = calculateLoopComplexity(forPath);
      console.log('complexity', complexity);
      if (complexity > config.performanceThreshold.complexity) {
        found = true;
      }
    },
    WhileStatement() {
      found = true;
    },
    DoWhileStatement() {
      found = true;
    },
  });

  return found;
}

function checkForExpensiveOperations(path: NodePath): boolean {
  let found = false;
  const ARRAY_SIZE_THRESHOLD = 1000; // 배열 크기 임계값

  path.traverse({
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      // Array 생성 감지 (예: Array(1000))
      if (t.isMemberExpression(callee)) {
        const property = callee.property;
        if (t.isIdentifier(property)) {
          // 비용이 많이 드는 배열 작업 체크
          const expensiveArrayOps = ['map', 'filter', 'reduce', 'sort'];
          if (expensiveArrayOps.includes(property.name)) {
            // 배열 크기 체크
            const arraySize = getArraySize(callPath);
            if (arraySize > ARRAY_SIZE_THRESHOLD) {
              found = true;
            }
          }
        }
      }
      // Array 생성자 호출 감지
      if (t.isIdentifier(callee) && callee.name === 'Array') {
        const args = callPath.node.arguments;
        console.log(args);
        if (args.length > 0 && t.isNumericLiteral(args[0])) {
          if (args[0].value > ARRAY_SIZE_THRESHOLD) {
            found = true;
          }
        }
      }
    },
  });

  return found;
}

// 예시 사용:
/*
이제 다음과 같은 패턴들을 감지할 수 있습니다:

1. 대규모 Array 생성:
const items = Array(10000).fill(0);

2. 대규모 배열에 대한 map/filter 등의 연산:
const items = Array(10000).fill(0).map((_, i) => i);

3. 대규모 리터럴 배열에 대한 연산:
const items = [...Array(10000)].map((_, i) => i);

4. 체이닝된 배열 메서드:
const items = Array(10000)
  .fill(0)
  .map((_, i) => i)
  .filter(x => x % 2 === 0);
*/

// 배열 크기를 추정하는 헬퍼 함수
function getArraySize(path: NodePath): number {
  let size = 0;

  // Array 생성자 체크 (예: Array(1000))
  if (path.parentPath) {
    let currentParent: NodePath | null = path.parentPath;
    while (currentParent !== null) {
      if (currentParent.isCallExpression()) {
        const callee = currentParent.node.callee;
        if (t.isIdentifier(callee) && callee.name === 'Array') {
          const args = currentParent.node.arguments;
          if (args.length > 0 && t.isNumericLiteral(args[0])) {
            size = args[0].value;
            break;
          }
        }
      }
      currentParent = currentParent.parentPath;
    }
  }

  // 리터럴 배열 체크 (예: [1,2,3].map())
  if (path.parentPath && t.isCallExpression(path.parentPath.node)) {
    const parentCall = path.parentPath.node;
    if (t.isMemberExpression(parentCall.callee)) {
      const object = parentCall.callee.object;
      if (t.isArrayExpression(object)) {
        size = object.elements.length;
      }
    }
  }

  return size;
}

function checkForStateChanges(path: NodePath): boolean {
  let found = false;

  path.traverse({
    CallExpression(callPath) {
      if (isStateUpdate(callPath)) {
        found = true;
      }
    },
  });

  return found;
}

function isStateUpdate(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  return t.isIdentifier(callee) && callee.name.startsWith('set');
}

function isEffectHook(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  return t.isIdentifier(callee) && callee.name === 'useEffect';
}

function calculateLoopComplexity(path: NodePath): number {
  let complexity = 1;
  let nestedLoops = 0;

  path.traverse({
    ForStatement() {
      nestedLoops++;
    },
    WhileStatement() {
      nestedLoops++;
    },
    DoWhileStatement() {
      nestedLoops++;
    },
  });

  return complexity * Math.pow(2, nestedLoops);
}
