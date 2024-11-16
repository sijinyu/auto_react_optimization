import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export const HOOK_TYPES = {
  STATE: 'useState',
  EFFECT: 'useEffect',
  MEMO: 'useMemo',
  CALLBACK: 'useCallback',
  REF: 'useRef',
  CONTEXT: 'useContext',
  REDUCER: 'useReducer',
} as const;

export function getNode<T extends t.Node>(input: NodePath<T> | T): T {
  return input instanceof NodePath ? input.node : input;
}

// 3. Hook 관련 체크
export function isHook(
  input: NodePath<t.CallExpression> | t.CallExpression
): boolean {
  const node = getNode(input);
  return (
    t.isIdentifier(node.callee) &&
    node.callee.name.startsWith('use') &&
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

export function getComponentName(path: NodePath): string | null {
  if (path.isFunctionDeclaration() && path.node.id) {
    return path.node.id.name;
  }

  let parentNode = path.parentPath?.node;
  if (
    parentNode &&
    'id' in parentNode &&
    parentNode.id?.type === 'Identifier'
  ) {
    return parentNode.id.name;
  }

  // export default 케이스 처리
  const exportDefault = path.findParent((p) => p.isExportDefaultDeclaration());
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
