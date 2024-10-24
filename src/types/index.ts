export interface AnalyzerConfig {
  memoThreshold: {
    propsCount: number;
    renderCount: number;
  };
  performanceThreshold: {
    complexity: number;
    arraySize: number;
    computationWeight: number;
  };
  ignorePatterns: string[];
  customRules: OptimizationRule[];
}

export interface EventHandler {
  name: string;
  type: 'click' | 'change' | 'submit' | 'custom';
  usesProps: boolean;
  usesState: boolean;
}

export interface ChildComponent {
  name: string;
  isMemoized: boolean;
  receivedFunctions: string[];
}
export interface PropInfo {
  name: string;
  type: PropType;
  usageCount: number;
  isRequired: boolean;
  updates: number;
  genericTypes?: PropType[]; // 제네릭 타입 정보 추가
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

export interface ComponentAnalysis {
  name: string;
  filePath: string;
  props: PropInfo[];
  hooks: HookInfo[];
  complexity: ComplexityMetrics;
  renderAnalysis: RenderAnalysis;
  dependencies: string[];
  suggestions: OptimizationSuggestion[];
}

export interface PropInfo {
  name: string;
  type: PropType;
  usageCount: number;
  isRequired: boolean;
  updates: number;
  genericTypes?: PropType[];
}

export interface HookInfo {
  name: string;
  type: HookType;
  dependencies: string[];
  complexity: number;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  dependencies: number;
}

export interface RenderAnalysis {
  estimatedRenderCount: number;
  hasExpensiveCalculations: boolean;
  hasExpensiveOperations: boolean;
  affectedByStateChanges: boolean;
  eventHandlers: EventHandler[];
  hasEventHandlers: boolean;
  hasChildComponents: boolean;
  memoizedComponents: ChildComponent[];
  functionPropPassing: boolean;
  hasStateUpdates: boolean;
}

export interface OptimizationSuggestion {
  type: string;
  description: string;
  priority: number;
  impact: Impact;
  codeExample: string;
}

export interface Impact {
  renderTimeImprovement: number;
  memoryImprovement: number;
  bundleSizeImpact: number;
}

export interface OptimizationRule {
  name: string;
  description: string;
  priority: number;
  test: (analysis: ComponentAnalysis) => boolean;
  suggestion: (analysis: ComponentAnalysis) => string;
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
