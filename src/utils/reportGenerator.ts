import * as fs from 'fs';
import { OptimizationSuggestion } from '../types';

export interface ReportOptions {
  format: 'json' | 'html' | 'markdown';
  outputPath: string;
  verbose: boolean;
}

export async function generateReport(
  suggestions: OptimizationSuggestion[],
  options: ReportOptions
): Promise<void> {
  const content = formatReport(suggestions, options.format);
  await fs.promises.writeFile(options.outputPath, content);
}

function formatReport(
  suggestions: OptimizationSuggestion[],
  format: ReportOptions['format']
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(suggestions, null, 2);
    case 'html':
      return generateHtmlReport(suggestions);
    case 'markdown':
      return generateMarkdownReport(suggestions);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function generateHtmlReport(suggestions: OptimizationSuggestion[]): string {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>React Optimization Report</title>
          <style>
            /* Add your styles here */
          </style>
        </head>
        <body>
          <h1>React Optimization Report</h1>
          ${suggestions
            .map(
              (suggestion) => `
            <div class="suggestion">
              <h2>${suggestion.type}</h2>
              <p>${suggestion.description}</p>
              <pre><code>${suggestion.codeExample}</code></pre>
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `;
}

function generateMarkdownReport(suggestions: OptimizationSuggestion[]): string {
  return `
  # React Optimization Report
  
  ${suggestions
    .map(
      (suggestion) => `
  ## ${suggestion.type}
  
  ${suggestion.description}
  
  \`\`\`typescript
  ${suggestion.codeExample}
  \`\`\`
  `
    )
    .join('\n')}`;
}
