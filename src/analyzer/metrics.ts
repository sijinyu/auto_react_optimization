import { NodePath } from '@babel/traverse';
import { ComplexityMetrics } from '../types';

export function calculateComplexity(path: NodePath): ComplexityMetrics {
  let cyclomaticComplexity = 1;
  let cognitiveComplexity = 0;
  let linesOfCode = 0;
  let dependencies = 0;

  path.traverse({
    // 조건문
    IfStatement() {
      cyclomaticComplexity++;
    },
    // 반복문
    DoWhileStatement() {
      cyclomaticComplexity++;
      cognitiveComplexity += 2;
    },

    ForStatement() {
      cyclomaticComplexity++;
      cognitiveComplexity += 2;
    },
    WhileStatement() {
      cyclomaticComplexity++;
      cognitiveComplexity += 2;
    },
    LogicalExpression() {
      cyclomaticComplexity++;
    },
    ConditionalExpression() {
      cyclomaticComplexity++;
      cognitiveComplexity++;
    },
  });

  const code = path.toString();
  linesOfCode = code.split('\n').length;

  return {
    cyclomaticComplexity,
    cognitiveComplexity,
    linesOfCode,
    dependencies,
  };
}
