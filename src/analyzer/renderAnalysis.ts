import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import {
  AnalyzerConfig,
  RenderAnalysis,
  EventHandler,
  ChildComponent,
} from "../types";
import { isHook, isSpecificHook, HOOK_TYPES } from "../utils/astUtils";
import { isStateUpdate } from "./hooks";

export function analyzeRenderingBehavior(
  path: NodePath,
  config: AnalyzerConfig
): RenderAnalysis {
  let hasChildComponents = false;

  path.traverse({
    JSXElement(jsxPath) {
      const openingElement = jsxPath.node.openingElement;
      const elementName = openingElement.name;

      // 대문자로 시작하는 컴포넌트 이름 체크
      if (
        t.isJSXIdentifier(elementName) &&
        elementName.name[0] === elementName.name[0].toUpperCase()
      ) {
        hasChildComponents = true;
      }
    },
  });

  const analysis: RenderAnalysis = {
    estimatedRenderCount: calculateEstimatedRenderCount(path),
    hasExpensiveCalculations: checkForExpensiveCalculations(path, config),
    hasExpensiveOperations: checkForExpensiveOperations(path, config),
    affectedByStateChanges: checkForStateChanges(path),
    eventHandlers: findEventHandlers(path),
    hasEventHandlers: false,
    hasChildComponents,
    memoizedComponents: findMemoizedComponents(path),
    functionPropPassing: false,
    hasStateUpdates: false,
  };

  // 부가 정보 설정
  analysis.hasEventHandlers = analysis.eventHandlers.length > 0;
  analysis.functionPropPassing = checkForFunctionPropPassing(path);
  analysis.hasStateUpdates = checkForStateUpdates(path);

  return analysis;
}

function calculateEstimatedRenderCount(path: NodePath): number {
  let count = 1; // 초기 렌더링

  path.traverse({
    CallExpression(callPath) {
      const node = callPath.node;
      if (!isHook(node)) return;

      if (isSpecificHook(node, HOOK_TYPES.STATE)) {
        count += 2; // setState 호출 가능성
      } else if (isSpecificHook(node, HOOK_TYPES.EFFECT)) {
        count += 1; // effect 재실행 가능성
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
  const threshold = config.performanceThreshold.complexity;

  path.traverse({
    ForStatement(forPath) {
      if (calculateLoopComplexity(forPath) > threshold) {
        found = true;
      }
    },
    WhileStatement(whilePath) {
      if (calculateLoopComplexity(whilePath) > threshold) {
        found = true;
      }
    },
  });

  return found;
}

function checkForExpensiveOperations(
  path: NodePath,
  config: AnalyzerConfig
): boolean {
  let found = false;
  const arrayThreshold = config.performanceThreshold.arraySize;

  path.traverse({
    CallExpression(callPath) {
      const node = callPath.node;
      if (t.isMemberExpression(node.callee)) {
        const property = node.callee.property;
        if (t.isIdentifier(property)) {
          const methodName = property.name;
          if (["map", "filter", "reduce"].includes(methodName)) {
            const arraySize = estimateArraySize(callPath);
            if (arraySize > arrayThreshold) {
              found = true;
            }
          }
        }
      }
    },
  });

  return found;
}

function findEventHandlers(path: NodePath): EventHandler[] {
  const handlers: EventHandler[] = [];
  const processedHandlers = new Set<string>();

  path.traverse({
    JSXAttribute(attrPath) {
      const name = attrPath.node.name;
      if (!t.isJSXIdentifier(name) || !name.name.startsWith("on")) return;

      const value = attrPath.node.value;
      if (!t.isJSXExpressionContainer(value)) return;

      const handler = analyzeEventHandler(attrPath, value.expression);
      if (handler && !processedHandlers.has(handler.name)) {
        handlers.push(handler);
        processedHandlers.add(handler.name);
      }
    },
  });

  return handlers;
}

function findMemoizedComponents(path: NodePath): ChildComponent[] {
  const components: ChildComponent[] = [];
  const processedComponents = new Set<string>();

  path.traverse({
    CallExpression(callPath) {
      const node = callPath.node;
      if (!t.isMemberExpression(node.callee)) return;

      const object = node.callee.object;
      const property = node.callee.property;

      if (
        t.isIdentifier(object) &&
        object.name === "React" &&
        t.isIdentifier(property) &&
        property.name === "memo"
      ) {
        const componentInfo = analyzeMemoizedComponent(callPath);
        if (componentInfo && !processedComponents.has(componentInfo.name)) {
          components.push(componentInfo);
          processedComponents.add(componentInfo.name);
        }
      }
    },
  });

  return components;
}

function calculateLoopComplexity(path: NodePath): number {
  let complexity = 1;
  let nestedLoops = 0;

  path.traverse({
    "ForStatement|WhileStatement|DoWhileStatement"() {
      nestedLoops++;
    },
  });

  return complexity * Math.pow(2, nestedLoops);
}

function estimateArraySize(path: NodePath): number {
  // 배열 크기 추정 로직 구현
  // 1. 리터럴 배열의 경우 elements.length
  // 2. Array 생성자 사용 시 인자 값
  // 3. 그 외의 경우 보수적으로 추정
  return 1000; // 기본값
}

function analyzeEventHandler(
  path: NodePath<t.JSXAttribute>,
  expression: t.Expression | t.JSXEmptyExpression
): EventHandler | null {
  // JSXEmptyExpression이거나 함수/식별자가 아닌 경우 처리
  if (
    t.isJSXEmptyExpression(expression) ||
    (!t.isIdentifier(expression) && !t.isFunction(expression))
  ) {
    return null;
  }

  const name = t.isIdentifier(expression) ? expression.name : "anonymous";

  // JSXNamespacedName 처리 추가
  const eventName = t.isJSXNamespacedName(path.node.name)
    ? path.node.name.name.name
    : path.node.name.name;

  return {
    name,
    type: getEventType(eventName),
    usesProps: checkUsesProps(path),
    usesState: checkUsesState(path),
    hasCleanup: checkHasCleanup(path),
  };
}

// getEventType 수정
function getEventType(name: string): EventHandler["type"] {
  const loweredName = name.toLowerCase();
  if (loweredName.includes("click")) return "click";
  if (loweredName.includes("change")) return "change";
  if (loweredName.includes("submit")) return "submit";
  return "custom";
}

function checkForStateChanges(path: NodePath): boolean {
  let found = false;

  path.traverse({
    CallExpression(callPath: NodePath<t.CallExpression>) {
      if (isStateUpdate(callPath)) {
        found = true;
      }
    },
  });

  return found;
}

// Props 사용 체크
function checkUsesProps(path: NodePath): boolean {
  let usesProps = false;

  path.traverse({
    Identifier(idPath) {
      if (idPath.node.name === "props") {
        usesProps = true;
      }
      // props 구조 분해 할당 체크
      const binding = idPath.scope.getBinding(idPath.node.name);
      if (binding?.path.isObjectPattern()) {
        const parent = binding.path.parentPath;
        if (
          parent?.isVariableDeclarator() &&
          t.isIdentifier(parent.node.init) &&
          parent.node.init.name === "props"
        ) {
          usesProps = true;
        }
      }
    },
  });

  return usesProps;
}

// State 사용 체크
function checkUsesState(path: NodePath): boolean {
  let usesState = false;

  path.traverse({
    CallExpression(callPath) {
      if (isHook(callPath) && isSpecificHook(callPath, HOOK_TYPES.STATE)) {
        usesState = true;
      }
    },
    Identifier(idPath) {
      // setState 패턴 체크
      if (
        idPath.node.name.startsWith("set") &&
        idPath.node.name[3] === idPath.node.name[3].toUpperCase()
      ) {
        usesState = true;
      }
    },
  });

  return usesState;
}

// Cleanup 함수 체크
function checkHasCleanup(path: NodePath): boolean {
  let hasCleanup = false;

  path.traverse({
    // useEffect cleanup 체크
    ReturnStatement(returnPath) {
      const functionParent = returnPath.getFunctionParent();
      if (functionParent && isEffectCallback(functionParent)) {
        hasCleanup = true;
      }
    },
    // 이벤트 리스너 제거 체크
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isMemberExpression(callee)) {
        const prop = callee.property;
        if (t.isIdentifier(prop) && prop.name === "removeEventListener") {
          hasCleanup = true;
        }
      }
    },
  });

  return hasCleanup;
}

// Effect 콜백인지 체크
function isEffectCallback(path: NodePath): boolean {
  let isEffect = false;
  let current: NodePath | null = path;

  while (current) {
    if (current.isCallExpression()) {
      const callee = current.node.callee;
      if (t.isIdentifier(callee) && callee.name === HOOK_TYPES.EFFECT) {
        isEffect = true;
        break;
      }
    }
    current = current.parentPath;
  }

  return isEffect;
}

// React.memo 컴포넌트 분석
function analyzeMemoizedComponent(
  path: NodePath<t.CallExpression>
): ChildComponent | null {
  const arg = path.node.arguments[0];
  if (
    !t.isIdentifier(arg) &&
    !t.isFunctionExpression(arg) &&
    !t.isArrowFunctionExpression(arg)
  ) {
    return null;
  }

  return {
    name: t.isIdentifier(arg) ? arg.name : "AnonymousMemoComponent",
    isMemoized: true,
    receivedFunctions: findReceivedFunctions(path),
  };
}

// 컴포넌트가 받는 함수형 props 찾기
function findReceivedFunctions(path: NodePath): string[] {
  const functions: string[] = [];

  path.traverse({
    JSXAttribute(attrPath) {
      const value = attrPath.node.value;
      if (
        t.isJSXExpressionContainer(value) &&
        t.isIdentifier(value.expression) &&
        isFunctionType(value.expression, path)
      ) {
        functions.push((attrPath.node.name as t.JSXIdentifier).name);
      }
    },
  });

  return functions;
}

// 함수형 prop인지 체크
function isFunctionType(identifier: t.Identifier, path: NodePath): boolean {
  const binding = path.scope.getBinding(identifier.name);
  if (!binding) return false;

  const bindingPath = binding.path;
  return (
    bindingPath.isFunctionDeclaration() ||
    (bindingPath.isVariableDeclarator() &&
      (t.isFunctionExpression(bindingPath.node.init) ||
        t.isArrowFunctionExpression(bindingPath.node.init)))
  );
}

// 함수형 props 전달 체크
function checkForFunctionPropPassing(path: NodePath): boolean {
  let passesFunctions = false;

  path.traverse({
    JSXAttribute(attrPath) {
      const value = attrPath.node.value;
      if (!t.isJSXExpressionContainer(value)) return;

      const expression = value.expression;
      if (t.isJSXEmptyExpression(expression)) return;

      if (
        t.isFunction(expression) ||
        (t.isIdentifier(expression) && isFunctionType(expression, path))
      ) {
        const parentCall = getParentCallExpression(attrPath);
        if (!parentCall || !isHook(parentCall)) {
          passesFunctions = true;
        }
      }
    },
  });

  return passesFunctions;
}

// 상태 업데이트 체크
function checkForStateUpdates(path: NodePath): boolean {
  let hasStateUpdates = false;
  // useState 호출 추적을 위한 Set
  const stateSetters = new Set<string>();

  // 먼저 useState 호출을 찾아서 setter 함수들을 수집
  path.traverse({
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isIdentifier(callee) && callee.name === "useState") {
        const parent = callPath.parentPath;
        if (
          parent?.isVariableDeclarator() &&
          t.isArrayPattern(parent.node.id)
        ) {
          const setter = parent.node.id.elements[1];
          if (t.isIdentifier(setter)) {
            stateSetters.add(setter.name);
          }
        }
      }
    },
  });

  // 그 다음 setter 함수들의 호출을 찾음
  path.traverse({
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isIdentifier(callee) && stateSetters.has(callee.name)) {
        hasStateUpdates = true;
      }
    },
    // setState 메서드 호출도 체크
    MemberExpression(memberPath) {
      if (
        t.isIdentifier(memberPath.node.property) &&
        memberPath.node.property.name === "setState"
      ) {
        hasStateUpdates = true;
      }
    },
  });

  return hasStateUpdates;
}

// 부모 CallExpression 노드 가져오기
function getParentCallExpression(
  path: NodePath
): NodePath<t.CallExpression> | null {
  let current: NodePath | null = path;
  while (current) {
    if (current.isCallExpression()) {
      return current as NodePath<t.CallExpression>;
    }
    current = current.parentPath;
  }
  return null;
}
