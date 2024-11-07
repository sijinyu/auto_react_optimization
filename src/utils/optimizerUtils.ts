// src/utils/optimizerUtils.ts
import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import {
  ComponentAnalysis,
  Impact,
  OptimizationRule,
  RenderAnalysis,
} from "../types";
import { isHook } from "./astUtils";

// 1. 성능 영향도 계산
export function calculateImpact(
  rule: OptimizationRule,
  analysis: ComponentAnalysis
): Impact {
  return {
    renderTimeImprovement: estimateRenderTimeImprovement(analysis),
    memoryImprovement: estimateMemoryImprovement(analysis),
    bundleSizeImpact: estimateBundleSizeImpact(rule),
  };
}

export function calculateArrayOperationComplexity(path: NodePath<t.CallExpression>): number {
  let complexity = 0;
  
  // 메서드 체인의 전체 복잡도 계산
  let currentPath: NodePath<t.CallExpression> = path;
  while (currentPath) {
    const node = currentPath.node;
    if (t.isMemberExpression(node.callee)) {
      const property = node.callee.property;
      if (t.isIdentifier(property) && ['map', 'filter', 'reduce'].includes(property.name)) {
        complexity += 1;
        
        // 콜백 함수의 복잡도 계산
        const [callback] = node.arguments;
        if (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback)) {
          if (t.isObjectExpression(callback.body)) {
            complexity += 1;
          }
          
          // 콜백 내부의 연산 복잡도 계산
          currentPath.traverse({
            IfStatement() { complexity += 1; },
            ConditionalExpression() { complexity += 1; },
            BinaryExpression() { complexity += 0.5; },
            CallExpression() { complexity += 0.5; }
          });
        }
      }
    }
    
    // 체인의 이전 호출로 이동
    const callee = currentPath.get('callee');
    if (callee.isMemberExpression()) {
      const object = callee.get('object');
      if (!Array.isArray(object) && object.type === 'CallExpression') {
        currentPath = object as NodePath<t.CallExpression>;
      } else {
        break;
      }
    } else {
      break;
    }
  }
 
  return complexity;
 }


function estimateRenderTimeImprovement(analysis: ComponentAnalysis): number {
  const { complexity, renderAnalysis } = analysis;
  let improvement = 0;

  // 복잡도 기반 개선 예상치
  improvement += complexity.cyclomaticComplexity * 0.1;

  // 렌더링 행동 기반 개선 예상치
  if (renderAnalysis.hasExpensiveCalculations) {
    improvement += 0.2;
  }

  if (renderAnalysis.hasExpensiveOperations) {
    improvement += 0.15;
  }

  // 정규화 (0-1 범위로)
  return Math.min(Math.max(improvement, 0), 1);
}

function estimateMemoryImprovement(analysis: ComponentAnalysis): number {
  const { renderAnalysis, hooks } = analysis;
  let improvement = 0;

  // 메모리 누수 가능성이 있는 패턴 체크
  if (hasMemoryLeakPotential(renderAnalysis, hooks)) {
    improvement += 0.3;
  }

  // 불필요한 재렌더링으로 인한 메모리 사용
  if (renderAnalysis.estimatedRenderCount > 5) {
    improvement += 0.2;
  }

  return Math.min(Math.max(improvement, 0), 1);
}

function estimateBundleSizeImpact(rule: OptimizationRule): number {
  // 각 최적화 규칙별 번들 크기 영향도
  const IMPACT_WEIGHTS = {
    useMemoForExpensiveCalculations: 0.01,
    useCallbackForEventHandlers: 0.01,
    reactMemoForPureComponents: 0.02,
  };

  return IMPACT_WEIGHTS[rule.name as keyof typeof IMPACT_WEIGHTS] || 0;
}

// 2. 메모이제이션 필요성 분석
export function shouldUseMemo(path: NodePath): boolean {
  const complexity = calculateOperationComplexity(path);
  const renderCount = estimateRenderCount(path);

  return complexity > 5 || renderCount > 3;
}

function calculateOperationComplexity(path: NodePath): number {
  let complexity = 0;

  path.traverse({
    // 루프 복잡도
    "ForStatement|WhileStatement|DoWhileStatement"() {
      complexity += 2;
    },
    // 조건문 복잡도
    "IfStatement|ConditionalExpression"() {
      complexity += 1;
    },
    // 배열 메서드 복잡도
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
        const methodName = callee.property.name;
        if (["map", "filter", "reduce"].includes(methodName)) {
          complexity += 1;
        }
      }
    },
  });

  return complexity;
}

// 3. 컴포넌트 렌더링 분석
function estimateRenderCount(path: NodePath): number {
  let count = 1; // 초기 렌더링

  path.traverse({
    CallExpression(callPath) {
      const node = callPath.node;
      if (isHook(node)) {
        const hookName = (node.callee as t.Identifier).name;
        if (hookName === "useState" || hookName === "useReducer") {
          count += 2; // 상태 업데이트 가능성
        } else if (hookName === "useEffect") {
          count += 1; // 부수 효과로 인한 렌더링
        }
      }
    },
  });

  return count;
}

// 4. 메모리 누수 가능성 분석
function hasMemoryLeakPotential(
  renderAnalysis: RenderAnalysis,
  hooks: ComponentAnalysis["hooks"]
): boolean {
  // Effect 정리(cleanup) 함수 누락 체크
  const hasUnclearedEffects = hooks.some(
    (hook) => hook.type === "useEffect" && !hasCleanupFunction(hook)
  );

  // 이벤트 리스너 정리 누락 체크
  const hasUnclearedEventListeners = renderAnalysis.eventHandlers.some(
    (handler) => !handler.hasCleanup
  );

  return hasUnclearedEffects || hasUnclearedEventListeners;
}

function hasCleanupFunction(hook: ComponentAnalysis["hooks"][0]): boolean {
  // Effect의 반환 함수 존재 여부 체크
  return hook.complexity > 1; // 정리 함수가 있다면 복잡도가 더 높음
}

// 5. 최적화 제안 우선순위 계산
export function calculateOptimizationPriority(
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

  // 성능 영향도에 따른 가중치
  const impact = calculateImpact(rule, analysis);
  if (impact.renderTimeImprovement > 0.3) {
    priority += 1;
  }

  return priority;
}

// 6. 캐시 관리
type TOptimizationCache = Map<string, Set<string>>;

export class OptimizationCache {
  private cache: TOptimizationCache = new Map();

  public has(componentHash: string, optimizationType: string): boolean {
    const optimizations = this.cache.get(componentHash);
    return optimizations?.has(optimizationType) || false;
  }

  public add(componentHash: string, optimizationType: string): void {
    if (!this.cache.has(componentHash)) {
      this.cache.set(componentHash, new Set());
    }
    this.cache.get(componentHash)!.add(optimizationType);
  }

  public clear(): void {
    this.cache.clear();
  }
}
