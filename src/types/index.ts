// 1. 기본 설정 타입
export interface AnalyzerConfig {
  memoThreshold: {
    propsCount: number; // props 개수 임계값
    renderCount: number; // 렌더링 횟수 임계값
  };
  performanceThreshold: {
    complexity: number; // 복잡도 임계값
    arraySize: number; // 배열 크기 임계값
    computationWeight: number; // 연산 가중치
  };
  ignorePatterns: string[]; // 무시할 파일 패턴
  customRules: OptimizationRule[]; // 사용자 정의 규칙
}

// 2. 컴포넌트 분석 결과 타입
export interface ComponentAnalysis {
  name: string; // 컴포넌트 이름
  filePath: string; // 파일 경로
  props: PropInfo[]; // props 정보
  hooks: HookInfo[]; // hooks 사용 정보
  complexity: ComplexityMetrics; // 복잡도 메트릭
  renderAnalysis: RenderAnalysis; // 렌더링 분석
  dependencies: string[]; // 의존성 목록
  suggestions: OptimizationSuggestion[]; // 최적화 제안
}

// 3. Props 관련 타입
export interface PropInfo {
  name: string;
  type: PropType;
  usageCount: number; // 사용 횟수
  isRequired: boolean; // 필수 여부
  updates: number; // 업데이트 횟수
  genericTypes?: PropType[]; // 제네릭 타입 정보
}

export type PropType =
  | "string"
  | "number"
  | "boolean"
  | "function"
  | "object"
  | "array"
  | "element"
  | "node"
  | "custom";

// 4. Hook 관련 타입
export interface HookInfo {
  name: string;
  type: HookType;
  dependencies: string[]; // 의존성 배열
  complexity: number; // hook 복잡도
  wrappedFunction?: string;  // useCallback이 감싸고 있는 함수 이름

}

export type HookType =
  | "useState"
  | "useEffect"
  | "useMemo"
  | "useCallback"
  | "useRef"
  | "useContext"
  | "useReducer"
  | "custom";

// 5. 복잡도 메트릭
export interface ComplexityMetrics {
  cyclomaticComplexity: number; // 순환 복잡도
  cognitiveComplexity: number; // 인지 복잡도
  linesOfCode: number; // 코드 라인 수
  dependencies: number; // 의존성 수
}

// 6. 렌더링 분석
export interface RenderAnalysis {
  estimatedRenderCount: number; // 예상 렌더링 횟수
  hasExpensiveCalculations: boolean; // 비용이 많이 드는 계산 포함 여부
  hasExpensiveOperations: boolean; // 비용이 많이 드는 연산 포함 여부
  affectedByStateChanges: boolean; // 상태 변경에 영향받는지 여부
  eventHandlers: EventHandler[]; // 이벤트 핸들러 목록
  hasEventHandlers: boolean; // 이벤트 핸들러 존재 여부
  hasChildComponents: boolean; // 자식 컴포넌트 존재 여부
  memoizedComponents: ChildComponent[]; // 메모이제이션된 컴포넌트
  functionPropPassing: boolean; // 함수형 props 전달 여부
  hasStateUpdates: boolean; // 상태 업데이트 존재 여부
}

// 7. 이벤트 핸들러
export interface EventHandler {
  name: string;
  type: "click" | "change" | "submit" | "custom";
  usesProps: boolean; // props 사용 여부
  usesState: boolean; // 상태 사용 여부
  hasCleanup: boolean; // 정리 함수 존재 여부
}

// 8. 자식 컴포넌트
export interface ChildComponent {
  name: string;
  isMemoized: boolean; // 메모이제이션 여부
  receivedFunctions: string[]; // 전달받은 함수 목록
}

// 9. 최적화 제안
export interface OptimizationSuggestion {
  type: string; // 제안 유형
  description: string; // 설명
  priority: number; // 우선순위
  impact: Impact; // 영향도
  codeExample: string; // 코드 예시
}

// 10. 성능 영향도
export interface Impact {
  renderTimeImprovement: number; // 렌더링 시간 개선도
  memoryImprovement: number; // 메모리 사용 개선도
  bundleSizeImpact: number; // 번들 크기 영향도
}

// 11. 최적화 규칙
export interface OptimizationRule {
  name: string;
  description: string;
  priority: number;
  test: (analysis: ComponentAnalysis) => boolean;
  suggestion: (analysis: ComponentAnalysis) => string;
}
