import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import crypto from "crypto";

export const HOOK_TYPES = {
  STATE: "useState",
  EFFECT: "useEffect",
  MEMO: "useMemo",
  CALLBACK: "useCallback",
  REF: "useRef",
  CONTEXT: "useContext",
  REDUCER: "useReducer",
} as const;

type NodeWithComments = t.Node & {
  leadingComments?: Array<t.Comment> | null;
  innerComments?: Array<t.Comment> | null;
  trailingComments?: Array<t.Comment> | null;
};

export function getNode<T extends t.Node>(input: NodePath<T> | T): T {
  return input instanceof NodePath ? input.node : input;
}

// 1. AST 노드 해시 생성
export function generateASTHash(node: t.Node): string {
  const cleanNode = removeNodeMetadata(node);
  const nodeString = JSON.stringify(cleanNode);
  return crypto.createHash("sha256").update(nodeString).digest("hex");
}

function removeNodeMetadata(node: t.Node): Record<string, any> {
  const nodeWithComments = node as NodeWithComments;
  const obj: Record<string, any> = { ...node };

  // 메타데이터 제거
  delete obj.start;
  delete obj.end;
  delete obj.loc;

  // 주석 관련 필드 제거
  if (nodeWithComments.leadingComments) delete obj.leadingComments;
  if (nodeWithComments.innerComments) delete obj.innerComments;
  if (nodeWithComments.trailingComments) delete obj.trailingComments;

  // 순환 참조 방지
  delete obj.parent;
  delete obj.parentPath;
  delete obj.scope;

  // 재귀적으로 자식 노드들 처리
  for (const key in obj) {
    const value = obj[key];
    if (Array.isArray(value)) {
      obj[key] = value.map((item) =>
        t.isNode(item) ? removeNodeMetadata(item) : item
      );
    } else if (value && typeof value === "object" && t.isNode(value)) {
      obj[key] = removeNodeMetadata(value);
    }
  }

  return obj;
}

// 2. React 컴포넌트 관련 체크
export function isReactComponent(path: NodePath): boolean {
  // 함수 선언이나 화살표 함수가 아니면 컴포넌트가 아님
  if (!path.isFunctionDeclaration() && 
      !path.isFunctionExpression() && 
      !path.isArrowFunctionExpression()) {
    return false;
  }

  // 최상위 레벨 체크
  const isTopLevel = path.findParent(p => p.isProgram());
  if (!isTopLevel) return false;

  // export 체크
  const isExported = path.findParent(p => 
    p.isExportNamedDeclaration() || p.isExportDefaultDeclaration()
  );
  if (!isExported) return false;

  let hasJSX = false;

  // JSX 사용 여부 확인
  path.traverse({
    JSXElement() { hasJSX = true; },
    JSXFragment() { hasJSX = true; },
  });

  if (!hasJSX) return false;

  // 컴포넌트 이름이 대문자로 시작하는지 확인
  const componentName = getComponentName(path);
  if(!componentName) return false
  return componentName[0] === componentName[0].toUpperCase();
}


// 3. Hook 관련 체크
export function isHook(
  input: NodePath<t.CallExpression> | t.CallExpression
): boolean {
  const node = getNode(input);
  return (
    t.isIdentifier(node.callee) &&
    node.callee.name.startsWith("use") &&
    node.callee.name[3] === node.callee.name[3].toUpperCase()
  );
}

export function isSpecificHook(
  input: NodePath<t.CallExpression> | t.CallExpression,
  hookName: string
): boolean {
  const node = getNode(input);
  return t.isIdentifier(node.callee) && node.callee.name === hookName;
}

export function getHookDependencies(
  input: NodePath<t.CallExpression> | t.CallExpression
): string[] {
  const node = getNode(input);
  const dependencies: string[] = [];
  const depsArg = node.arguments[1];

  if (t.isArrayExpression(depsArg)) {
    depsArg.elements.forEach((element) => {
      if (t.isIdentifier(element)) {
        dependencies.push(element.name);
      }
    });
  }

  return dependencies;
}

export function isUseMemoCall(node: t.CallExpression): boolean {
  return t.isIdentifier(node.callee) && node.callee.name === "useMemo";
}

export function isUseCallbackCall(node: t.CallExpression): boolean {
  return t.isIdentifier(node.callee) && node.callee.name === "useCallback";
}

// 4. 컴포넌트 이름 추출

export function getComponentName(path: NodePath): string | null {
  if (path.isFunctionDeclaration() && path.node.id) {
    return path.node.id.name;
  }

  let parentNode = path.parentPath?.node;
  if (parentNode && 'id' in parentNode && parentNode.id?.type === 'Identifier') {
    return parentNode.id.name;
  }

  // export default 케이스 처리
  const exportDefault = path.findParent(p => p.isExportDefaultDeclaration());
  if (exportDefault) {
    const previous = exportDefault.getPrevSibling();
    if (previous.isVariableDeclaration()) {
      const declaration = previous.node.declarations[0];
      if (t.isIdentifier(declaration.id)) {
        return declaration.id.name;
      }
    }
  }

  return null; // 이름을 알 수 없는 경우 null 반환
}
// 5. 복잡도 관련
export function hasNestedLoops(path: NodePath): boolean {
  let loopDepth = 0;
  let hasNested = false;

  path.traverse({
    "ForStatement|WhileStatement|DoWhileStatement"(path) {
      loopDepth++;
      if (loopDepth > 1) hasNested = true;
      path.skip(); // 더 깊은 중첩은 건너뛰기
    },
  });

  return hasNested;
}

// 6. 이벤트 핸들러 체크
export function isEventHandler(name: string): boolean {
  return /^(on[A-Z]|handle[A-Z])/.test(name);
}
