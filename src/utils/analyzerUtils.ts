import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { PropInfo, PropType } from "../types";
// 1. Props 분석 관련
export function analyzeProps(path: NodePath): PropInfo[] {
  const props: PropInfo[] = [];
  const processedProps = new Set<string>();

  // 함수 매개변수에서 props 분석
  const params = path.get('params');
  if (Array.isArray(params)) {
    params.forEach(param => {
      if (param.isObjectPattern()) {
        const properties = param.get('properties');
        if (Array.isArray(properties)) {
          properties.forEach(prop => {
            if (prop.isObjectProperty()) {
              const key = prop.get('key');
              if (key.isIdentifier()) {
                const name = key.node.name;
                const isHandler = name.startsWith('handle') || name.startsWith('on');
                
                if (!processedProps.has(name)) {
                  props.push({
                    name,
                    type: isHandler ? 'function' : 'custom',
                    usageCount: countPropUsage(path, name),
                    isRequired: !isOptionalProp(prop.node),
                    updates: countPropUpdates(path, name)
                  });
                  processedProps.add(name);
                }
              }
            }
          });
        }
      }
    });
  }

  return props;
}


// 3. 타입 추론 관련
function inferPropType(prop: t.ObjectProperty): PropType {
  if (t.isIdentifier(prop.value)) {
    // 함수명이 handle 또는 on으로 시작하는 경우 function으로 판단
    if (prop.value.name.startsWith('handle') || prop.value.name.startsWith('on')) {
      return 'function';
    }
  }
  if (!t.isIdentifier(prop.value)) return "custom";
   // TypeScript 타입 체크
   if (t.isTSTypeAnnotation(prop.value.typeAnnotation)) {
    const tsType = prop.value.typeAnnotation.typeAnnotation;
    if (t.isTSFunctionType(tsType) || 
        (t.isTSTypeReference(tsType) && 
         t.isIdentifier(tsType.typeName) && 
         tsType.typeName.name === 'Function')) {
      return 'function';
    }
  }
  return 'custom'
}

function getTypeFromTSType(type: t.TSType): PropType {
  if (t.isTSStringKeyword(type)) return "string";
  if (t.isTSNumberKeyword(type)) return "number";
  if (t.isTSBooleanKeyword(type)) return "boolean";
  if (t.isTSArrayType(type)) return "array";
  if (t.isTSFunctionType(type)) return "function";

  if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
    switch (type.typeName.name) {
      case "Array":
        return "array";
      case "Function":
        return "function";
      case "ReactElement":
        return "element";
      case "ReactNode":
        return "node";
      default:
        return "custom";
    }
  }

  return "custom";
}

// 4. 사용량 분석 관련
function countPropUsage(path: NodePath, propName: string): number {
  let count = 0;

  path.traverse({
    Identifier(idPath) {
      if (
        idPath.node.name === propName &&
        !idPath.parentPath?.isObjectProperty()
      ) {
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
  if (!t.isIdentifier(prop.value)) return false;

  const typeAnnotation = prop.value.typeAnnotation;
  if (!typeAnnotation || !t.isTSTypeAnnotation(typeAnnotation)) return false;

  const tsType = typeAnnotation.typeAnnotation;
  return (
    t.isTSUnionType(tsType) &&
    tsType.types.some(
      (type) =>
        t.isTSUndefinedKeyword(type) ||
        t.isTSNullKeyword(type) ||
        (t.isTSLiteralType(type) && t.isNullLiteral(type.literal))
    )
  );
}
