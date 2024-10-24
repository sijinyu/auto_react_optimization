import * as fs from 'fs';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import type { AnalyzerConfig, ComponentAnalysis } from '../types';
import { analyzeComponent } from './componentAnalyzer';
import { findFiles } from '../utils/fileUtils';

export async function analyzeProject(
  sourceDir: string,
  config: AnalyzerConfig
): Promise<ComponentAnalysis[]> {
  const results: ComponentAnalysis[] = [];

  try {
    const files = await findFiles(sourceDir, ['.jsx', '.tsx', '.js', '.ts']);

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      const fileResults = await analyzeFile(content, file, config);
      results.push(...fileResults);
    }
  } catch (error) {
    console.error('Error during project analysis:', error);
  }

  return results;
}

async function analyzeFile(
  content: string,
  filePath: string,
  config: AnalyzerConfig
): Promise<ComponentAnalysis[]> {
  const analyses: ComponentAnalysis[] = [];

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        if (isReactComponent(path)) {
          const analysis = analyzeComponent(path, filePath, config);
          analyses.push(analysis);
        }
      },
      ArrowFunctionExpression(path) {
        if (isReactComponent(path)) {
          const analysis = analyzeComponent(path, filePath, config);
          analyses.push(analysis);
        }
      },
    });
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
  }

  return analyses;
}

function isReactComponent(path: NodePath): boolean {
  let hasJSX = false;
  path.traverse({
    JSXElement() {
      hasJSX = true;
    },
    JSXFragment() {
      hasJSX = true;
    },
  });
  return hasJSX;
}
