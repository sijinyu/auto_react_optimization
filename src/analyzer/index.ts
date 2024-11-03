import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { AnalyzerConfig, ComponentAnalysis } from "../types";
import { analyzeComponent } from "./componentAnalyzer";
import { findFiles, readFileContent } from "../utils/fileUtils";

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
            const analysis = analyzeComponent(path, filePath, config);
            analyses.push(analysis);
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

function isReactComponent(path: any): boolean {
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

class AnalysisError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "AnalysisError";
  }
}
