import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { ComponentAnalysis, AnalyzerConfig, HookInfo } from '../types';
import { analyzeRenderingBehavior } from './renderAnalysis';
import { calculateComplexity } from './metrics';
import { analyzeProps, getComponentName } from '../utils';

export function analyzeComponent(
  path: NodePath,
  filePath: string,
  config: AnalyzerConfig
): ComponentAnalysis {
  return {
    name: getComponentName(path),
    filePath,
    props: analyzeProps(path),
    hooks: analyzeHooks(path),
    complexity: calculateComplexity(path),
    renderAnalysis: analyzeRenderingBehavior(path, config),
    dependencies: analyzeDependencies(path),
    suggestions: [],
  };
}

function analyzeDependencies(path: NodePath): string[] {
  const dependencies = new Set<string>();

  path.traverse({
    ImportDeclaration(importPath) {
      dependencies.add(importPath.node.source.value);
    },
    CallExpression(callPath) {
      if (isHook(callPath)) {
        dependencies.add('react');
      }
    },
  });

  return Array.from(dependencies);
}

function isHook(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  return t.isIdentifier(callee) && callee.name.startsWith('use');
}

function analyzeHooks(path: NodePath): HookInfo[] {
  const hooks: HookInfo[] = [];

  path.traverse({
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isIdentifier(callee) && callee.name.startsWith('use')) {
        hooks.push({
          name: callee.name,
          type: callee.name as any,
          dependencies: extractHookDependencies(callPath),
          complexity: calculateHookComplexity(callPath),
        });
      }
    },
  });

  return hooks;
}

function extractHookDependencies(path: NodePath<t.CallExpression>): string[] {
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

function calculateHookComplexity(path: NodePath<t.CallExpression>): number {
  let complexity = 1;

  // 훅의 콜백 함수 내부 복잡도 분석
  const callback = path.node.arguments[0];
  if (t.isFunction(callback)) {
    path.traverse({
      IfStatement() {
        complexity++;
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
      ConditionalExpression() {
        complexity++;
      },
    });
  }

  return complexity;
}
