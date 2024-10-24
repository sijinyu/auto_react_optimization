import { Command } from 'commander';
import { analyzeProject } from '../analyzer';
import { generateReport } from '../utils/reportGenerator';
import { OptimizationEngine } from '../optimizer';
import type { ComponentAnalysis, OptimizationSuggestion } from '../types';
import { loadConfig } from '../analyzer/utils';
import * as fs from 'fs';
import { isReactComponent } from '../utils';
import path from 'path';

const program = new Command();

program
  .name('react-optimizer')
  .description('Analyze React components for optimization opportunities')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze React components in a directory')
  .option('-p, --path <path>', 'specific file or directory path to analyze')
  .option('-c, --config <path>', 'path to config file')
  .option(
    '-o, --output <path>',
    'output path for report',
    './optimization-report'
  )
  .option(
    '-f, --format <type>',
    'report format (json|html|markdown)',
    'markdown'
  )

  .option('-v, --verbose', 'verbose output')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const targetPath = options.path || process.cwd();

      let analysisResults: ComponentAnalysis[] = [];

      if (options.verbose) {
        console.log('Analyzing path:', targetPath);
      }

      // 파일인지 디렉토리인지 확인
      const stats = await fs.promises.stat(targetPath);

      if (stats.isFile()) {
        // 단일 파일 분석
        if (isReactFile(targetPath)) {
          const content = await fs.promises.readFile(targetPath, 'utf-8');
          const fileResults = await analyzeProject(content, config);
          analysisResults.push(...fileResults);
        }
      } else if (stats.isDirectory()) {
        // 디렉토리 분석
        analysisResults = await analyzeProject(targetPath, config);
      }

      // 최적화 제안 생성
      const optimizer = new OptimizationEngine(config);

      const suggestions: OptimizationSuggestion[] = [];

      for (const analysis of analysisResults) {
        const componentSuggestions = optimizer.generateSuggestions(analysis);
        suggestions.push(...componentSuggestions);
      }

      const reportOptions = {
        format: options.format,
        outputPath: `${options.output}.${options.format}`,
        verbose: options.verbose,
      };

      await generateReport(suggestions, reportOptions);

      console.log(
        `\nAnalysis complete! Report generated at ${reportOptions.outputPath}`
      );

      if (suggestions.length > 0) {
        console.log(
          '\nOptimization opportunities found! Check the report for details.'
        );
      } else {
        console.log('\nNo significant optimization opportunities found.');
      }
    } catch (error) {
      console.error('Error during analysis:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);

function isReactFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jsx', '.tsx', '.js', '.ts'].includes(ext);
}

export default program;
