import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { AnalyzerConfig, ComponentAnalysis } from "../types";
import { isReactComponent } from "../utils";
import { findFiles, readFileContent } from "../utils/fileUtils";
import { analyzeComponent } from "./componentAnalyzer";

export async function analyzeProject(
  sourceDir: string,
  config: AnalyzerConfig
): Promise<ComponentAnalysis[]> {
  try {
    const files = await findFiles(sourceDir, [".jsx", ".tsx", ".js", ".ts"]);
    const analysisPromises = files.map((file) => analyzeFile(file, config));
    return (await Promise.all(analysisPromises)).flat();
  } catch (error) {
    console.error("Error during project analysis:", error);
    throw new AnalysisError("Project analysis failed", error as Error);
  }
}

async function analyzeFile(
  filePath: string,
  config: AnalyzerConfig
): Promise<ComponentAnalysis[]> {
  try {
    const content = await readFileContent(filePath);
    const ast = parse(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    });

    const analyses: ComponentAnalysis[] = [];

    traverse(ast, {
      "FunctionDeclaration|ArrowFunctionExpression|FunctionExpression"(path) {
        try {
          if (isReactComponent(path)) {
            const isTopLevel = path.scope.parent === null;
          
            // 컴포넌트가 아닌 경우 분석하지 않음
            if (!isTopLevel) {
              const analysis = analyzeComponent(path, filePath, config);
              analyses.push(analysis);
            } 
          }
        } catch (error) {
          console.warn(`Failed to analyze component in ${filePath}:`, error);
        }
      },
    });

    return analyses;
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    return [];
  }
}


class AnalysisError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "AnalysisError";
  }
}
