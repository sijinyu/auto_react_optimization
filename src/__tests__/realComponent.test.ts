import { analyzeProject } from "../analyzer";
import { OptimizationEngine } from "../optimizer/optimizationEngine";
import path from "path";

describe("Real Component Analysis", () => {
  it("should analyze and optimize real React components", async () => {
    const componentsPath = path.join(__dirname, "../examples");
    const config = {
      memoThreshold: { propsCount: 2, renderCount: 3 },
      performanceThreshold: {
        complexity: 5,
        arraySize: 100,
        computationWeight: 0.7,
      },
      ignorePatterns: [],
      customRules: [],
    };

    const analysisResults = await analyzeProject(componentsPath, config);
    const optimizer = new OptimizationEngine(config);

    analysisResults.forEach((analysis) => {
      const suggestions = optimizer.generateSuggestions(analysis);
      console.log(`\nAnalysis for ${analysis.name}:`);
      console.log("Component Stats:");
      console.log("- Hooks:", analysis.hooks.length);
      console.log(
        "- Event Handlers:",
        analysis.renderAnalysis.eventHandlers.length
      );
      console.log(
        "- Has Child Components:",
        analysis.renderAnalysis.hasChildComponents
      );
      console.log(
        "- Has State Updates:",
        analysis.renderAnalysis.hasStateUpdates
      );

      console.log("\nOptimization Suggestions:");
      suggestions.forEach((suggestion) => {
        console.log(`\n${suggestion.type}:`);
        console.log(suggestion.description);
        console.log("Priority:", suggestion.priority);
        console.log("Impact:", suggestion.impact);
      });
    });
  });
});
