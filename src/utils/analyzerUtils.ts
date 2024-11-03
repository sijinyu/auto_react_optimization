import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { PropInfo, PropType } from "../types";
// 1. Props 분석 관련
export function analyzeProps(path: NodePath): PropInfo[] {
  const props: PropInfo[] = [];
  const processedProps = new Set<string>();

  path.traverse({
    ObjectPattern(objPath) {
      const parent = objPath.parentPath;
      if (!isPropsDestructuring(parent)) return;

      objPath.node.properties.forEach((prop) => {
        if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) return;

        const propName = prop.key.name;
        if (processedProps.has(propName)) return;

        props.push(createPropInfo(prop, path));
        processedProps.add(propName);
      });
    },
  });

  return props;
}

function isPropsDestructuring(path: NodePath | null): boolean {
  if (!path?.isVariableDeclarator()) return false;
  const init = path.node.init;
  return t.isIdentifier(init) && init.name === "props";
}

function createPropInfo(prop: t.ObjectProperty, path: NodePath): PropInfo {
  if (!t.isIdentifier(prop.key)) {
    throw new Error("Prop key must be an identifier");
  }

  return {
    name: prop.key.name,
    type: inferPropType(prop),
    usageCount: countPropUsage(path, prop.key.name),
    isRequired: !isOptionalProp(prop),
    updates: countPropUpdates(path, prop.key.name),
  };
}

// 3. 타입 추론 관련
function inferPropType(prop: t.ObjectProperty): PropType {
  if (!t.isIdentifier(prop.value)) return "custom";

  const typeAnnotation = prop.value.typeAnnotation;
  if (!typeAnnotation || !t.isTSTypeAnnotation(typeAnnotation)) {
    return "custom";
  }

  return getTypeFromTSType(typeAnnotation.typeAnnotation);
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
