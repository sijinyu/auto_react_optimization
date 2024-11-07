import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { AnalyzerConfig, ComponentAnalysis } from "../types";
import { getComponentName } from "../utils";
import { analyzeProps } from "../utils/analyzerUtils";
import { isHook } from "../utils/astUtils";
import { analyzeHooks } from "./hooks";
import { calculateComplexity } from "./metrics";
import { analyzeRenderingBehavior } from "./renderAnalysis";

export function analyzeComponent(
  path: NodePath,
  filePath: string,
  config: AnalyzerConfig
): ComponentAnalysis {
    // React 컴포넌트인지 확인
  const name = getComponentName(path);

  if (!name) {
    throw new Error('Not a valid React component');
  }

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
