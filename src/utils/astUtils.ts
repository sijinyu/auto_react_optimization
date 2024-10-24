import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export function isReactComponent(path: NodePath): boolean {
  if (
    path.isFunctionDeclaration() ||
    path.isArrowFunctionExpression() ||
    path.isFunctionExpression()
  ) {
    return containsJSX(path);
  }
  return false;
}

export function containsJSX(path: NodePath): boolean {
  let foundJSX = false;
  path.traverse({
    JSXElement() {
      foundJSX = true;
    },
    JSXFragment() {
      foundJSX = true;
    },
  });
  return foundJSX;
}

export function getComponentName(path: NodePath): string {
  if (path.isFunctionDeclaration() && path.node.id) {
    return path.node.id.name;
  }

  if (path.isArrowFunctionExpression() || path.isFunctionExpression()) {
    const parent = path.parentPath;
    if (parent.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
      return parent.node.id.name;
    }
  }

  return 'AnonymousComponent';
}
