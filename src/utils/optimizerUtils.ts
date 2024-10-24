import type { ComponentAnalysis, Impact, OptimizationRule } from '../types';

export function calculateImpact(
  rule: OptimizationRule,
  analysis: ComponentAnalysis
): Impact {
  const renderTimeImprovement = estimateRenderTimeImprovement(rule, analysis);
  const memoryImprovement = estimateMemoryImprovement(rule, analysis);
  const bundleSizeImpact = estimateBundleSizeImpact(rule);

  return {
    renderTimeImprovement,
    memoryImprovement,
    bundleSizeImpact,
  };
}

function estimateRenderTimeImprovement(
  rule: OptimizationRule,
  analysis: ComponentAnalysis
): number {
  // 실제로는 더 복잡한 계산이 필요하지만, 예시로 간단한 계산 제공
  return analysis.complexity.cyclomaticComplexity * 0.1;
}

function estimateMemoryImprovement(
  rule: OptimizationRule,
  analysis: ComponentAnalysis
): number {
  // 메모리 개선 추정
  return analysis.complexity.dependencies * 0.05;
}

function estimateBundleSizeImpact(rule: OptimizationRule): number {
  // 번들 크기 영향 추정
  return 0.01;
}
