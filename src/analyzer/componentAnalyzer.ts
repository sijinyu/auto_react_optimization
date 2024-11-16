import { NodePath } from '@babel/traverse';
import { AnalyzerConfig, ComponentAnalysis } from '../types';
import { getComponentName } from '../utils';
import { analyzeProps } from '../utils/analyzerUtils';
import { analyzeHooks } from './hooks';
import { calculateComplexity } from './metrics';
import { analyzeRenderingBehavior } from './renderAnalysis';

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
  };
  validateAnalysis(analysis);
  return analysis;
}

function validateAnalysis(analysis: ComponentAnalysis): void {
  if (!analysis.name) {
    throw new Error('Component analysis must have a name');
  }
  if (!analysis.props) {
    throw new Error('Component analysis must include props analysis');
  }
  if (!analysis.hooks) {
    throw new Error('Component analysis must include hooks analysis');
  }
}
