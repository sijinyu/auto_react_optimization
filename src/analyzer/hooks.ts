import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { HookInfo, HookType } from "../types";
import { getHookDependencies, HOOK_TYPES, isHook } from "../utils/astUtils";

export function analyzeHooks(path: NodePath): HookInfo[] {
  const hooks: Set<HookInfo> = new Set();
  const analyzedHooks = new Set<string>();


  path.traverse({
    CallExpression(callPath) {
      if (!isHook(callPath)) return;
      const node = callPath.node;
      const hookName = (node.callee as t.Identifier).name;

      // 중복 분석 방지
      const hookSignature = generateHookSignature(callPath);
      if (analyzedHooks.has(hookSignature)) return;
      analyzedHooks.add(hookSignature);

      // useCallback인 경우 감싸고 있는 함수 이름 찾기
      let wrappedFunction;
      if (hookName === 'useCallback') {
        const parent = callPath.findParent((p)=> t.isVariableDeclarator(p.node))
        if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
          wrappedFunction = parent.node.id.name;
        }
      }

      hooks.add({
        name: hookName,
        type: determineHookType(hookName),
        dependencies: getHookDependencies(callPath),
        complexity: calculateHookComplexity(callPath),
        wrappedFunction
      });
    }
  });

  return Array.from(hooks);
}

function generateHookSignature(path: NodePath<t.CallExpression>): string {
  const node = path.node;
  const loc = node.loc;

  return `${(node.callee as t.Identifier).name}:${loc?.start.line}:${
    loc?.start.column
  }`;
}

function determineHookType(hookName: string): HookType {
  switch (hookName) {
    case HOOK_TYPES.STATE:
      return "useState";
    case HOOK_TYPES.EFFECT:
      return "useEffect";
    case HOOK_TYPES.MEMO:
      return "useMemo";
    case HOOK_TYPES.CALLBACK:
      return "useCallback";
    case HOOK_TYPES.REF:
      return "useRef";
    case HOOK_TYPES.CONTEXT:
      return "useContext";
    case HOOK_TYPES.REDUCER:
      return "useReducer";
    default:
      return "custom";
  }
}

function calculateHookComplexity(path: NodePath<t.CallExpression>): number {
  let complexity = 1;
  const callback = path.node.arguments[0];

  // Hook이 콜백을 받지 않는 경우 (예: useRef)
  if (!callback || !t.isFunction(callback)) {
    return complexity;
  }

  // 콜백 함수의 복잡도 분석
  const callbackPath = path.get("arguments.0") as NodePath<t.Function>;

  if (callbackPath) {
    callbackPath.traverse({
      // 조건문
      IfStatement() {
        complexity++;
      },
      // 반복문
      "ForStatement|WhileStatement|DoWhileStatement"() {
        complexity += 2;
      },
      // 삼항 연산자
      ConditionalExpression() {
        complexity++;
      },
      // 논리 연산자
      LogicalExpression() {
        complexity++;
      },
      // API 호출
      CallExpression(callPath: NodePath<t.CallExpression>) {
        if (isStateUpdate(callPath)) {
          complexity++;
        }
      },
      // 상태 업데이트
      MemberExpression(memberPath: NodePath<t.MemberExpression>) {
        if (isStateUpdate(memberPath)) {
          complexity++;
        }
      },
    });
  }

  // 의존성 배열 분석
  const dependencies = getHookDependencies(path);
  complexity += Math.ceil(dependencies.length / 3);

  return complexity;
}

export function isStateUpdate(
  path: NodePath<t.MemberExpression | t.CallExpression>
): boolean {
  // MemberExpression인 경우 (예: this.setState)
  if (path.isMemberExpression()) {
    const property = path.node.property;
    return t.isIdentifier(property) && property.name === "setState";
  }

  // CallExpression인 경우 (예: setCount(1))
  if (path.isCallExpression()) {
    return isStateUpdateCall(path);
  }

  return false;
}

export function isStateUpdateCall(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  if (!t.isIdentifier(callee)) return false;

  // useState의 setter 함수 체크
  const binding = path.scope.getBinding(callee.name);
  if (binding?.path.parentPath?.isVariableDeclarator()) {
    const init = (binding.path.parentPath.node as t.VariableDeclarator).init;
    if (
      t.isCallExpression(init) &&
      t.isIdentifier(init.callee) &&
      init.callee.name === HOOK_TYPES.STATE
    ) {
      return true;
    }
  }

  return false;
}

export function validateHookRules(path: NodePath): string[] {
  const violations: string[] = [];
  let isInsideLoop = false;
  let isInsideCondition = false;
  let hookCallOrder: string[] = [];

  path.traverse({
    "ForStatement|WhileStatement|DoWhileStatement"(path) {
      isInsideLoop = true;
      path.traverse({
        CallExpression(callPath) {
          if (isHook(callPath)) {
            violations.push(
              `Hook "${
                (callPath.node.callee as t.Identifier).name
              }" is called inside a loop`
            );
          }
        },
      });
      isInsideLoop = false;
    },

    IfStatement(path) {
      isInsideCondition = true;
      path.traverse({
        CallExpression(callPath) {
          if (isHook(callPath)) {
            violations.push(
              `Hook "${
                (callPath.node.callee as t.Identifier).name
              }" is called inside a condition`
            );
          }
        },
      });
      isInsideCondition = false;
    },

    CallExpression(callPath) {
      if (!isHook(callPath)) return;

      const hookName = (callPath.node.callee as t.Identifier).name;

      // Hook 호출 순서 체크
      if (!isInsideLoop && !isInsideCondition) {
        hookCallOrder.push(hookName);
      }

      // useEffect 의존성 배열 체크
      if (hookName === HOOK_TYPES.EFFECT) {
        validateEffectDependencies(callPath, violations);
      }
    },
  });

  // Hook 순서 일관성 체크
  if (!validateHookCallOrder(hookCallOrder)) {
    violations.push("Hooks are called in inconsistent order");
  }

  return violations;
}

function validateEffectDependencies(
  path: NodePath<t.CallExpression>,
  violations: string[]
): void {
  const deps = getHookDependencies(path);
  const callback = path.node.arguments[0];

  if (!t.isFunction(callback)) return;

  const callbackPath = path.get("arguments.0") as NodePath<t.Function>;

  if (callbackPath) {
    // 콜백 내에서 사용되는 외부 변수 찾기
    const usedVariables = new Set<string>();
    callbackPath.traverse({
      Identifier(idPath: NodePath<t.Identifier>) {
        const name = idPath.node.name;
        // props나 state 같은 외부 변수만 체크
        if (idPath.scope.hasBinding(name)) return;
        usedVariables.add(name);
      },
    });

    // 빠진 의존성 찾기
    usedVariables.forEach((variable) => {
      if (!deps.includes(variable)) {
        violations.push(`Effect is missing dependency: ${variable}`);
      }
    });
  }
}

function validateHookCallOrder(hookOrder: string[]): boolean {
  return !hookOrder.some((hook, index) => hookOrder.indexOf(hook) !== index);
}
