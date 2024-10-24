import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type {
  ChildComponent,
  ComponentAnalysis,
  EventHandler,
  PropInfo,
  PropType,
} from '../types';

export function extractHookDependencies(
  path: NodePath<t.CallExpression>
): string[] {
  const dependencies: string[] = [];
  const depsArg = path.node.arguments[1];

  if (t.isArrayExpression(depsArg)) {
    depsArg.elements.forEach((element) => {
      if (t.isIdentifier(element)) {
        dependencies.push(element.name);
      }
    });
  }

  return dependencies;
}

export function inferPropType(prop: t.ObjectProperty): PropType {
  if (!t.isIdentifier(prop.value)) {
    return 'custom';
  }

  const valueIdentifier = prop.value;
  const typeAnnotation = valueIdentifier.typeAnnotation;

  if (!typeAnnotation || !t.isTSTypeAnnotation(typeAnnotation)) {
    return 'custom';
  }

  const tsType = typeAnnotation.typeAnnotation;

  // Union 타입 체크
  if (t.isTSUnionType(tsType)) {
    return getBaseTypeFromUnion(tsType);
  }

  return getTypeFromTSType(tsType);
}

function getBaseTypeFromUnion(unionType: t.TSUnionType): PropType {
  // undefined와 null을 제외한 기본 타입 찾기
  const baseType = unionType.types.find((type) => {
    return (
      !t.isTSUndefinedKeyword(type) &&
      !t.isTSNullKeyword(type) &&
      !(t.isTSLiteralType(type) && t.isNullLiteral(type.literal))
    );
  });

  return baseType ? getTypeFromTSType(baseType) : 'custom';
}

function getTypeFromTSType(type: t.TSType): PropType {
  if (t.isTSStringKeyword(type)) return 'string';
  if (t.isTSNumberKeyword(type)) return 'number';
  if (t.isTSBooleanKeyword(type)) return 'boolean';
  if (t.isTSArrayType(type)) return 'array';
  if (t.isTSFunctionType(type)) return 'function';

  if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
    switch (type.typeName.name) {
      case 'Array':
        return 'array';
      case 'Function':
        return 'function';
      case 'ReactElement':
        return 'element';
      case 'ReactNode':
        return 'node';
      default:
        return 'custom';
    }
  }

  return 'custom';
}

export function analyzeProps(path: NodePath): PropInfo[] {
  const props: PropInfo[] = [];

  path.traverse({
    ObjectPattern(objPath) {
      const parent = objPath.parentPath;
      if (parent && parent.isVariableDeclarator()) {
        const init = parent.node.init;
        if (t.isIdentifier(init) && init.name === 'props') {
          objPath.node.properties.forEach((prop) => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              props.push(createPropInfo(prop, path));
            }
          });
        }
      }
    },
  });

  return props;
}

function createPropInfo(prop: t.ObjectProperty, path: NodePath): PropInfo {
  if (!t.isIdentifier(prop.key)) {
    throw new Error('Prop key must be an identifier');
  }

  return {
    name: prop.key.name,
    type: inferPropType(prop),
    usageCount: countPropUsage(path, prop.key.name),
    isRequired: !isOptionalProp(prop),
    updates: countPropUpdates(path, prop.key.name),
  };
}

function countPropUsage(path: NodePath, propName: string): number {
  let count = 0;
  path.traverse({
    Identifier(idPath) {
      if (idPath.node.name === propName) {
        count++;
      }
    },
  });
  return count;
}

function countPropUpdates(path: NodePath, propName: string): number {
  let count = 0;
  path.traverse({
    AssignmentExpression(assignPath) {
      if (
        t.isIdentifier(assignPath.node.left) &&
        assignPath.node.left.name === propName
      ) {
        count++;
      }
    },
  });
  return count;
}

function isOptionalProp(prop: t.ObjectProperty): boolean {
  if (!t.isIdentifier(prop.value)) {
    return false;
  }

  const typeAnnotation = prop.value.typeAnnotation;
  if (!typeAnnotation || !t.isTSTypeAnnotation(typeAnnotation)) {
    return false;
  }

  const tsType = typeAnnotation.typeAnnotation;
  if (t.isTSUnionType(tsType)) {
    return tsType.types.some(
      (type) =>
        t.isTSUndefinedKeyword(type) ||
        t.isTSNullKeyword(type) ||
        (t.isTSLiteralType(type) && t.isNullLiteral(type.literal))
    );
  }

  return false;
}

// 헬퍼 함수들
export function hasFunctionProps(analysis: ComponentAnalysis): boolean {
  return analysis.props.some((prop) => prop.type === 'function');
}

export function hasEventHandlers(analysis: ComponentAnalysis): boolean {
  return analysis.renderAnalysis.hasEventHandlers || false;
}

export function hasChildComponents(analysis: ComponentAnalysis): boolean {
  return analysis.renderAnalysis.hasChildComponents || false;
}

export function getFunctionDetails(analysis: ComponentAnalysis): string[] {
  const details: string[] = [];

  // 함수형 props 체크
  analysis.props
    .filter((prop) => prop.type === 'function')
    .forEach((prop) => details.push(`Function prop: ${prop.name}`));

  // 이벤트 핸들러 체크
  analysis.renderAnalysis.eventHandlers?.forEach((handler) => {
    details.push(`Event handler: ${handler.name}`);
  });

  return details;
}

export function generateCallbackExample(analysis: ComponentAnalysis): string {
  // 컴포넌트의 특성에 따라 적절한 예제 생성
  if (analysis.props.some((p) => p.name.startsWith('on'))) {
    return 'propCallback(params);';
  }
  if (analysis.renderAnalysis.hasStateUpdates) {
    return 'setState(newValue);';
  }
  return '// Your callback logic here';
}

export function hasReactMemoComponents(analysis: ComponentAnalysis): boolean {
  return analysis.renderAnalysis.memoizedComponents?.length > 0 || false;
}

export function hasFunctionPropPassing(analysis: ComponentAnalysis): boolean {
  return analysis.renderAnalysis.functionPropPassing || false;
}

export function getMemoizedComponentDetails(
  analysis: ComponentAnalysis
): string[] {
  const details: string[] = [];

  analysis.renderAnalysis.memoizedComponents?.forEach((comp) => {
    const functions = comp.receivedFunctions || [];
    details.push(`${comp.name} receives: ${functions.join(', ')}`);
  });

  return details;
}

export function analyzeEventHandler(
  path: NodePath,
  handlerName: string
): EventHandler | null {
  let handler: EventHandler | null = null;

  path.traverse({
    FunctionDeclaration(funcPath) {
      if (funcPath.node.id?.name === handlerName) {
        handler = createHandlerInfo(funcPath, handlerName);
      }
    },
    VariableDeclarator(varPath) {
      if (
        t.isIdentifier(varPath.node.id) &&
        varPath.node.id.name === handlerName &&
        (t.isArrowFunctionExpression(varPath.node.init) ||
          t.isFunctionExpression(varPath.node.init))
      ) {
        handler = createHandlerInfo(varPath, handlerName);
      }
    },
  });

  return handler;
}

function createHandlerInfo(path: NodePath, name: string): EventHandler {
  let usesProps = false;
  let usesState = false;

  path.traverse({
    Identifier(idPath) {
      if (idPath.node.name === 'props') {
        usesProps = true;
      }
      if (idPath.node.name.startsWith('set') && isStateUpdater(idPath)) {
        usesState = true;
      }
    },
  });

  return {
    name,
    type: getEventType(name),
    usesProps,
    usesState,
  };
}

function getEventType(handlerName: string): EventHandler['type'] {
  if (handlerName.toLowerCase().includes('click')) return 'click';
  if (handlerName.toLowerCase().includes('change')) return 'change';
  if (handlerName.toLowerCase().includes('submit')) return 'submit';
  return 'custom';
}

export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

export function analyzeFunctionProps(
  path: NodePath<t.JSXOpeningElement>,
  memoizedComponents: ChildComponent[]
) {
  path.node.attributes.forEach((attr) => {
    if (
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.value &&
      t.isJSXExpressionContainer(attr.value) &&
      t.isIdentifier(attr.value.expression)
    ) {
      const componentName = (path.node.name as t.JSXIdentifier).name;
      const existingComponent = memoizedComponents.find(
        (c) => c.name === componentName
      );

      if (existingComponent) {
        existingComponent.receivedFunctions.push(attr.name.name);
      }
    }
  });
}

export function isMemoCall(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  return (
    (t.isIdentifier(callee) && callee.name === 'memo') ||
    (t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      callee.object.name === 'React' &&
      t.isIdentifier(callee.property) &&
      callee.property.name === 'memo')
  );
}

export function getMemoComponentName(
  path: NodePath<t.CallExpression>
): string | null {
  const arg = path.node.arguments[0];
  if (t.isIdentifier(arg)) {
    return arg.name;
  }
  return null;
}

function isStateUpdater(path: NodePath<t.Identifier>): boolean {
  const binding = path.scope.getBinding(path.node.name);
  if (binding?.path.parent && t.isVariableDeclarator(binding.path.parent)) {
    const init = binding.path.parent.init;
    if (init && t.isCallExpression(init) && t.isIdentifier(init.callee)) {
      return init.callee.name === 'useState';
    }
  }
  return false;
}
