import chalk from "chalk";
import { Command } from "commander";
import path from "path";
import { analyzeProject } from "../analyzer";
import { OptimizationEngine } from "../optimizer";

const program = new Command();

program
  .name("react-hook-optimizer")
  .description("Analyze and optimize React components")
  .version("1.0.2")
  .option("-p, --path <path>", "path to React components", ".")
  .option("-c, --config <path>", "path to config file")
  .option("--verbose", "show detailed output")
  .action(async (options) => {
    try {
      console.log(chalk.blue("🔍 Analyzing React components...\n"));

      const targetPath = path.resolve(process.cwd(), options.path);
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

      const analysisResults = await analyzeProject(targetPath, config);
      const optimizer = new OptimizationEngine(config);

      console.log(
        chalk.green(`✨ Found ${analysisResults.length} components\n`)
      );

      analysisResults.forEach((analysis) => {
        const suggestions = optimizer.generateSuggestions(analysis);

        console.log(chalk.yellow(`\n📦 Component: ${analysis.name}`));
        console.log("  Location:", analysis.filePath);

        if (options.verbose) {
          console.log("  Stats:");
          console.log(`  - Hooks: ${analysis.hooks.length}`);
          console.log(
            `  - Event Handlers: ${analysis.renderAnalysis.eventHandlers.length}`
          );
          console.log(
            `  - Complexity: ${analysis.complexity.cyclomaticComplexity}`
          );
        }

        if (suggestions.length > 0) {
          console.log(chalk.cyan("\n  Optimization Suggestions:"));
          suggestions.forEach((suggestion) => {
            console.log(`\n  🔧 ${suggestion.type}`);
            console.log("  " + suggestion.description.replace(/\n/g, "\n  "));
          });
        } else {
          console.log(chalk.green("\n  ✅ No optimization needed"));
        }
      });
    } catch (error) {
      console.error(chalk.red("\n❌ Error:"), error);
      process.exit(1);
    }
  });

program.parse();

export default program;
