import { NodePath } from "@babel/traverse";
import { ComponentAnalysis, AnalyzerConfig } from "../types";
import { analyzeProps } from "../utils/analyzerUtils";
import { calculateComplexity } from "./metrics";
import { analyzeRenderingBehavior } from "./renderAnalysis";
import { getComponentName } from "../utils";
import { isHook } from "../utils/astUtils";
import * as t from "@babel/types";
import { analyzeHooks } from "./hooks";

export function analyzeComponent(
  path: NodePath,
  filePath: string,
  config: AnalyzerConfig
): ComponentAnalysis {
  const name = getComponentName(path);
  const analysis: ComponentAnalysis = {
    name,
    filePath,
    props: analyzeProps(path),
    hooks: analyzeHooks(path),
    complexity: calculateComplexity(path),
    renderAnalysis: analyzeRenderingBehavior(path, config),
    dependencies: analyzeDependencies(path),
    suggestions: [], // 최적화 엔진에서 나중에 채워짐
  };

  validateAnalysis(analysis);
  return analysis;
}

function analyzeDependencies(path: NodePath): string[] {
  const dependencies = new Set<string>();

  path.traverse({
    ImportDeclaration(importPath: NodePath<t.ImportDeclaration>) {
      const source = importPath.node.source.value;
      if (!source.startsWith(".") && !source.startsWith("/")) {
        dependencies.add(source);
      }
    },
    CallExpression(callPath: NodePath<t.CallExpression>) {
      if (isHook(callPath)) {
        dependencies.add("react");
      }
    },
  });

  return Array.from(dependencies);
}

function validateAnalysis(analysis: ComponentAnalysis): void {
  if (!analysis.name) {
    throw new Error("Component analysis must have a name");
  }
  if (!analysis.props) {
    throw new Error("Component analysis must include props analysis");
  }
  if (!analysis.hooks) {
    throw new Error("Component analysis must include hooks analysis");
  }
}
