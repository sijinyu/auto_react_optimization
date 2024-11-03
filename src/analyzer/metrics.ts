import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { ComplexityMetrics } from "../types";
import { isHook } from "../utils/astUtils";

export function calculateComplexity(path: NodePath): ComplexityMetrics {
  return {
    cyclomaticComplexity: calculateCyclomaticComplexity(path),
    cognitiveComplexity: calculateCognitiveComplexity(path),
    linesOfCode: calculateLinesOfCode(path),
    dependencies: calculateDependencies(path),
  };
}

function calculateCyclomaticComplexity(path: NodePath): number {
  let complexity = 1; // 기본 복잡도

  path.traverse({
    IfStatement() {
      complexity++;
    },
    SwitchCase() {
      complexity++;
    },
    LogicalExpression({ node }) {
      if (node.operator === "&&" || node.operator === "||") {
        complexity++;
      }
    },
    ForStatement() {
      complexity++;
    },
    WhileStatement() {
      complexity++;
    },
    DoWhileStatement() {
      complexity++;
    },
    TryStatement(tryPath) {
      complexity++; // try 블록
      complexity += tryPath.node.handler ? 1 : 0; // catch 블록
      complexity += tryPath.node.finalizer ? 1 : 0; // finally 블록
    },
  });

  return complexity;
}

function calculateCognitiveComplexity(path: NodePath): number {
  let complexity = 0;
  let depthModifier = 0;

  path.traverse({
    "IfStatement|WhileStatement|ForStatement|DoWhileStatement"(statementPath) {
      // 중첩 레벨에 따라 가중치 부여
      complexity += 1 + depthModifier;
      depthModifier++;

      statementPath.traverse({
        "IfStatement|WhileStatement|ForStatement|DoWhileStatement"() {
          complexity += 1 + depthModifier;
        },
      });

      depthModifier--;
    },
    ConditionalExpression() {
      complexity += 1;
    },
    LogicalExpression({ node }) {
      if (node.operator === "&&" || node.operator === "||") {
        complexity += 1;
      }
    },
  });

  return complexity;
}

function calculateLinesOfCode(path: NodePath): number {
  const code = path.toString();
  return code.split("\n").length;
}

function calculateDependencies(path: NodePath): number {
  const dependencies = new Set<string>();

  path.traverse({
    ImportDeclaration(importPath) {
      dependencies.add(importPath.node.source.value);
    },
    CallExpression(callPath: NodePath<t.CallExpression>) {
      if (isHook(callPath)) {
        dependencies.add("react");
      }
    },
  });

  return dependencies.size;
}
