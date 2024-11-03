import * as fs from "fs/promises";
import { OptimizationSuggestion, Impact, ComponentAnalysis } from "../types";

// 1. 보고서 설정 인터페이스
export interface ReportOptions {
  format: ReportFormat;
  outputPath: string;
  verbose: boolean;
  includeMetrics?: boolean;
  groupByComponent?: boolean;
}

type ReportFormat = "json" | "html" | "markdown";

// 2. 보고서 생성 메인 함수
export async function generateReport(
  suggestions: OptimizationSuggestion[],
  componentAnalyses: ComponentAnalysis[],
  options: ReportOptions
): Promise<void> {
  try {
    const content = await formatReport(suggestions, componentAnalyses, options);
    await fs.writeFile(options.outputPath, content, "utf-8");

    if (options.verbose) {
      console.log(`Report generated successfully at: ${options.outputPath}`);
    }
  } catch (error) {
    throw new ReportGenerationError(
      `Failed to generate report: ${(error as Error).message}`
    );
  }
}

function groupSuggestionsByComponent(
  suggestions: OptimizationSuggestion[]
): Record<string, OptimizationSuggestion[]> {
  const grouped: Record<string, OptimizationSuggestion[]> = {};

  suggestions.forEach((suggestion) => {
    const componentName = getComponentNameFromSuggestion(suggestion);
    if (!grouped[componentName]) {
      grouped[componentName] = [];
    }
    grouped[componentName].push(suggestion);
  });

  return grouped;
}

function getComponentNameFromSuggestion(
  suggestion: OptimizationSuggestion
): string {
  // description에서 컴포넌트 이름을 추출하는 로직
  const match = suggestion.description.match(/in `([^`]+)`/);
  return match?.[1] || "Unknown Component";
}

// 3. 보고서 포맷 선택
async function formatReport(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[],
  options: ReportOptions
): Promise<string> {
  const generators = {
    json: generateJsonReport,
    html: generateHtmlReport,
    markdown: generateMarkdownReport,
  };

  const generator = generators[options.format];
  if (!generator) {
    throw new Error(`Unsupported format: ${options.format}`);
  }

  return generator(suggestions, analyses, options);
}

// 4. JSON 포맷 생성
function generateJsonReport(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[],
  options: ReportOptions
): string {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: generateSummary(suggestions, analyses),
    suggestions: options.groupByComponent
      ? groupSuggestionsByComponent(suggestions)
      : suggestions,
    ...(options.includeMetrics
      ? {
          metrics: {
            complexity: calculateAverageComplexity(analyses),
            renderFrequency: calculateAverageRenderFrequency(analyses),
            hookUsage: analyzeHookUsage(analyses),
          },
        }
      : {}),
  };

  return JSON.stringify(report, null, 2);
}

// 5. HTML 포맷 생성
function generateHtmlReport(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[],
  options: ReportOptions
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>React Optimization Report</title>
  <style>
    ${getReportStyles()}
  </style>
</head>
<body>
  <div class="container">
    <h1>React Optimization Report</h1>
    
    ${generateHtmlSummary(suggestions, analyses)}
    
    ${options.includeMetrics ? generateHtmlMetrics(analyses) : ""}
    
    <div class="suggestions">
      <h2>Optimization Suggestions</h2>
      ${generateHtmlSuggestions(suggestions, options)}
    </div>
  </div>
</body>
</html>`;
}

// 6. Markdown 포맷 생성
function generateMarkdownReport(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[],
  options: ReportOptions
): string {
  return `
# React Optimization Report

${generateMarkdownSummary(suggestions, analyses)}

${options.includeMetrics ? generateMarkdownMetrics(analyses) : ""}

## Optimization Suggestions

${generateMarkdownSuggestions(suggestions, options)}
`;
}

// 7. 헬퍼 함수들
function generateSummary(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[]
): ReportSummary {
  return {
    totalComponents: analyses.length,
    totalSuggestions: suggestions.length,
    criticalSuggestions: suggestions.filter((s) => s.priority > 8).length,
    averageImpact: calculateAverageImpact(suggestions),
  };
}

function calculateAverageImpact(suggestions: OptimizationSuggestion[]): Impact {
  const total = suggestions.reduce(
    (acc, curr) => ({
      renderTimeImprovement:
        acc.renderTimeImprovement + curr.impact.renderTimeImprovement,
      memoryImprovement: acc.memoryImprovement + curr.impact.memoryImprovement,
      bundleSizeImpact: acc.bundleSizeImpact + curr.impact.bundleSizeImpact,
    }),
    { renderTimeImprovement: 0, memoryImprovement: 0, bundleSizeImpact: 0 }
  );

  const count = suggestions.length || 1;
  return {
    renderTimeImprovement: total.renderTimeImprovement / count,
    memoryImprovement: total.memoryImprovement / count,
    bundleSizeImpact: total.bundleSizeImpact / count,
  };
}

function generateMetrics(analyses: ComponentAnalysis[]): ReportMetrics {
  return {
    complexity: calculateAverageComplexity(analyses),
    renderFrequency: calculateAverageRenderFrequency(analyses),
    hookUsage: analyzeHookUsage(analyses),
  };
}

// 8. 스타일 정의
function getReportStyles(): string {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .suggestion {
      margin-bottom: 2rem;
      padding: 1rem;
      border: 1px solid #eee;
      border-radius: 4px;
    }
    .high-priority {
      border-left: 4px solid #dc3545;
    }
    code {
      background-color: #f8f9fa;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: monospace;
    }
  `;
}

// Markdown 요약 생성
function generateMarkdownSummary(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[]
): string {
  const summary = generateSummary(suggestions, analyses);

  return `
## Summary

- Total Components Analyzed: ${summary.totalComponents}
- Total Optimization Suggestions: ${summary.totalSuggestions}
- Critical Suggestions: ${summary.criticalSuggestions}

### Average Impact
- Render Time Improvement: ${(
    summary.averageImpact.renderTimeImprovement * 100
  ).toFixed(1)}%
- Memory Improvement: ${(summary.averageImpact.memoryImprovement * 100).toFixed(
    1
  )}%
- Bundle Size Impact: ${(summary.averageImpact.bundleSizeImpact * 100).toFixed(
    1
  )}%
`;
}

// Markdown 제안사항 생성
function generateMarkdownSuggestions(
  suggestions: OptimizationSuggestion[],
  options: ReportOptions
): string {
  if (suggestions.length === 0) {
    return "\nNo optimization suggestions found.";
  }

  return suggestions
    .map(
      (suggestion) => `
### ${suggestion.type}

${suggestion.description}

Priority: ${getPriorityLabel(suggestion.priority)}

\`\`\`typescript
${suggestion.codeExample}
\`\`\`
`
    )
    .join("\n");
}

// HTML 요약 생성
function generateHtmlSummary(
  suggestions: OptimizationSuggestion[],
  analyses: ComponentAnalysis[]
): string {
  const summary = generateSummary(suggestions, analyses);

  return `
    <div class="summary">
      <h2>Summary</h2>
      <ul>
        <li>Total Components Analyzed: ${summary.totalComponents}</li>
        <li>Total Optimization Suggestions: ${summary.totalSuggestions}</li>
        <li>Critical Suggestions: ${summary.criticalSuggestions}</li>
      </ul>
      
      <h3>Average Impact</h3>
      <ul>
        <li>Render Time Improvement: ${(
          summary.averageImpact.renderTimeImprovement * 100
        ).toFixed(1)}%</li>
        <li>Memory Improvement: ${(
          summary.averageImpact.memoryImprovement * 100
        ).toFixed(1)}%</li>
        <li>Bundle Size Impact: ${(
          summary.averageImpact.bundleSizeImpact * 100
        ).toFixed(1)}%</li>
      </ul>
    </div>
  `;
}

// HTML 제안사항 생성
function generateHtmlSuggestions(
  suggestions: OptimizationSuggestion[],
  options: ReportOptions
): string {
  if (suggestions.length === 0) {
    return "<p>No optimization suggestions found.</p>";
  }

  return suggestions
    .map(
      (suggestion) => `
      <div class="suggestion ${suggestion.priority > 8 ? "high-priority" : ""}">
        <h3>${suggestion.type}</h3>
        <p>${suggestion.description}</p>
        <p>Priority: <span class="priority-${getPriorityLevel(
          suggestion.priority
        )}">${getPriorityLabel(suggestion.priority)}</span></p>
        <pre><code>${suggestion.codeExample}</code></pre>
      </div>
    `
    )
    .join("");
}

// 메트릭스 생성 함수들
function calculateAverageComplexity(analyses: ComponentAnalysis[]): {
  average: number;
  highest: number;
} {
  if (analyses.length === 0) {
    return { average: 0, highest: 0 };
  }

  const complexities = analyses.map(
    (analysis) => analysis.complexity.cyclomaticComplexity
  );

  return {
    average: complexities.reduce((sum, val) => sum + val, 0) / analyses.length,
    highest: Math.max(...complexities),
  };
}

function calculateAverageRenderFrequency(analyses: ComponentAnalysis[]): {
  average: number;
  highest: number;
} {
  if (analyses.length === 0) {
    return { average: 0, highest: 0 };
  }

  const renderCounts = analyses.map(
    (analysis) => analysis.renderAnalysis.estimatedRenderCount
  );

  return {
    average: renderCounts.reduce((sum, val) => sum + val, 0) / analyses.length,
    highest: Math.max(...renderCounts),
  };
}

function generateHtmlMetrics(analyses: ComponentAnalysis[]): string {
  const metrics = generateMetrics(analyses);

  return `
    <div class="metrics">
      <h2>Performance Metrics</h2>
      <div class="metric-group">
        <h3>Complexity</h3>
        <p>Average: ${metrics.complexity.average.toFixed(2)}</p>
        <p>Highest: ${metrics.complexity.highest}</p>
      </div>
      <div class="metric-group">
        <h3>Render Frequency</h3>
        <p>Average: ${metrics.renderFrequency.average.toFixed(
          2
        )} renders/update</p>
        <p>Highest: ${metrics.renderFrequency.highest} renders/update</p>
      </div>
    </div>
  `;
}

function generateMarkdownMetrics(analyses: ComponentAnalysis[]): string {
  const metrics = generateMetrics(analyses);

  return `
## Performance Metrics

### Complexity
- Average: ${metrics.complexity.average.toFixed(2)}
- Highest: ${metrics.complexity.highest}

### Render Frequency
- Average: ${metrics.renderFrequency.average.toFixed(2)} renders/update
- Highest: ${metrics.renderFrequency.highest} renders/update
`;
}

// 유틸리티 함수들
function getPriorityLevel(priority: number): string {
  if (priority > 8) return "high";
  if (priority > 5) return "medium";
  return "low";
}

function getPriorityLabel(priority: number): string {
  if (priority > 8) return "High";
  if (priority > 5) return "Medium";
  return "Low";
}

function analyzeHookUsage(analyses: ComponentAnalysis[]): {
  [key: string]: number;
} {
  const hookUsage: { [key: string]: number } = {};

  analyses.forEach((analysis) => {
    analysis.hooks.forEach((hook) => {
      hookUsage[hook.type] = (hookUsage[hook.type] || 0) + 1;
    });
  });

  return hookUsage;
}

// 9. 커스텀 에러 클래스
class ReportGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportGenerationError";
  }
}

// 10. 인터페이스 정의
interface ReportSummary {
  totalComponents: number;
  totalSuggestions: number;
  criticalSuggestions: number;
  averageImpact: Impact;
}

interface ReportMetrics {
  complexity: {
    average: number;
    highest: number;
  };
  renderFrequency: {
    average: number;
    highest: number;
  };
  hookUsage: {
    [key: string]: number;
  };
}
