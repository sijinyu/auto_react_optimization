import { TSESTree } from '@typescript-eslint/types';

// 기본 설정 타입
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
}

// 컴포넌트 분석 결과 타입
export interface ComponentAnalysis {
  name: string; // 컴포넌트 이름
  filePath: string; // 파일 경로
  props: PropInfo[]; // props 정보
  hooks: HookInfo[]; // hooks 사용 정보
  complexity: ComplexityMetrics; // 복잡도 메트릭
  renderAnalysis: RenderAnalysis; // 렌더링 분석
  dependencies: string[]; // 의존성 목록
  expensiveNodes: []; // 연산이 비싼 특정 노드를 저장하는 배열 추가
}

export interface PropInfo {
  name: string;
  type: PropType;
  usageCount: number; // 사용 횟수
  isRequired: boolean; // 필수 여부
  updates: number; // 업데이트 횟수
}

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'function'
  | 'object'
  | 'array'
  | 'element'
  | 'node'
  | 'custom';

export interface HookInfo {
  name: string;
  type: HookType;
  dependencies: string[]; // 의존성 배열
  complexity: number; // hook 복잡도
  wrappedFunction?: string; // useCallback이 감싸고 있는 함수 이름
}

export type HookType =
  | 'useState'
  | 'useEffect'
  | 'useMemo'
  | 'useCallback'
  | 'useRef'
  | 'useContext'
  | 'useReducer'
  | 'custom';

// 복잡도 메트릭
export interface ComplexityMetrics {
  cyclomaticComplexity: number; // 순환 복잡도
  cognitiveComplexity: number; // 인지 복잡도
  linesOfCode: number; // 코드 라인 수
  dependencies: number; // 의존성 수
}

// 렌더링 분석
export interface RenderAnalysis {
  hasExpensiveCalculations: boolean; // 비용이 많이 드는 계산 포함 여부
  hasExpensiveOperations: boolean; // 비용이 많이 드는 연산 포함 여부
  eventHandlers: EventHandler[]; // 이벤트 핸들러 목록
  hasEventHandlers: boolean; // 이벤트 핸들러 존재 여부
  hasChildComponents: boolean; // 자식 컴포넌트 존재 여부
  functionPropPassing: boolean; // 함수형 props 전달 여부
  hasStateUpdates: boolean; // 상태 업데이트 존재 여부
}

// 이벤트 핸들러
export interface EventHandler {
  name: string;
  type: 'click' | 'change' | 'submit' | 'custom';
  usesProps: boolean; // props 사용 여부
  usesState: boolean; // 상태 사용 여부
  hasCleanup: boolean; // 정리 함수 존재 여부
}

export interface ChildComponent {
  name: string;
  isMemoized: boolean; // 메모이제이션 여부
  receivedFunctions: string[]; // 전달받은 함수 목록
}

export interface OptimizationRule {
  name: string;
  description: string;
  priority: number;
  test: (analysis: ComponentAnalysis) => boolean;
  suggestion: (analysis: ComponentAnalysis) => string;
}
