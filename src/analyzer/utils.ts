import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { AnalyzerConfig } from "../types";

export function isReactHook(path: NodePath): boolean {
  if (path.isCallExpression()) {
    const callee = path.node.callee;
    if (t.isIdentifier(callee)) {
      return (
        callee.name.startsWith("use") &&
        callee.name.length > 3 &&
        callee.name[3] === callee.name[3].toUpperCase()
      );
    }
  }
  return false;
}

export const defaultConfig: AnalyzerConfig = {
  memoThreshold: {
    propsCount: 3,
    renderCount: 5,
  },
  performanceThreshold: {
    complexity: 10,
    arraySize: 100,
    computationWeight: 0.7,
  },
  ignorePatterns: ["**/tests/**", "**/*.test.*", "**/stories/**"],
  customRules: [],
};

export function loadConfig(configPath?: string): AnalyzerConfig {
  if (configPath) {
    try {
      return require(configPath);
    } catch (error) {
      console.error(`Error loading config from ${configPath}:`, error);
    }
  }

  return defaultConfig;
}

export function isHook(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  return t.isIdentifier(callee) && callee.name.startsWith("use");
}
