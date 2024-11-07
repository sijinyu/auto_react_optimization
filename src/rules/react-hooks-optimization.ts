import { parse } from '@babel/parser';
import template from '@babel/template';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ESLintUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { analyzeComponent } from '../analyzer/componentAnalyzer';
import { defaultRules } from '../optimizer/rules';
import { AnalyzerConfig, ComponentAnalysis } from '../types';

type MessageIds =
  | 'useMemoSuggestion'
  | 'useCallbackSuggestion'
  | 'memoComponentSuggestion'
  | 'optimizeDependencySuggestion'
  | 'preventUpdatesSuggestion';

interface RuleOptions {
  memoThreshold: {
    propsCount: number;
    renderCount: number;
  };
  performanceThreshold: {
    complexity: number;
    arraySize: number;
    computationWeight: number;
  };
}

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/sijinyu/auto_react_optimization/blob/main/docs/rules/${name}.md`
);

export const reactHooksOptimization = createRule<[RuleOptions], MessageIds>({
  name: 'react-hooks-optimization',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Suggests optimizations for React hooks and components',
    },
    hasSuggestions: true, // 수정 제안 포함
    fixable: 'code', // 자동 수정 가능
    messages: {
      useMemoSuggestion: '{{ description }}',
      useCallbackSuggestion: '{{ description }}',
      memoComponentSuggestion: '{{ description }}',
      optimizeDependencySuggestion: '{{ description }}',
      preventUpdatesSuggestion: '{{ description }}',
    },
    schema: [
      {
        type: 'object',
        properties: {
          memoThreshold: {
            type: 'object',
            properties: {
              propsCount: { type: 'number' },
              renderCount: { type: 'number' },
            },
            required: ['propsCount', 'renderCount'],
          },
          performanceThreshold: {
            type: 'object',
            properties: {
              complexity: { type: 'number' },
              arraySize: { type: 'number' },
              computationWeight: { type: 'number' },
            },
            required: ['complexity', 'arraySize', 'computationWeight'],
          },
        },
        required: ['memoThreshold', 'performanceThreshold'],
        additionalProperties: false,
      },
    ],
  },

  defaultOptions: [
    {
      memoThreshold: {
        propsCount: 2,
        renderCount: 3,
      },
      performanceThreshold: {
        complexity: 5,
        arraySize: 100,
        computationWeight: 0.7,
      },
    },
  ],

  create(context, [options]) {
    const analyzerConfig: AnalyzerConfig = {
      memoThreshold: options.memoThreshold,
      performanceThreshold: options.performanceThreshold,
      ignorePatterns: [],
      customRules: [],
    };

    function convertToNodePath(node: TSESTree.Node): NodePath<t.Node> {
      const code = context.getSourceCode().getText(node);
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
      let resultPath: NodePath<t.Node> | null = null;

      traverse(ast, {
        enter(path) {
          if (path.node.type === node.type) {
            resultPath = path;
          }
        },
      });

      if (!resultPath) {
        throw new Error('Failed to convert ESTree node to Babel node');
      }

      return resultPath;
    }

    function createFix(
      fixer: TSESLint.RuleFixer,
      node: TSESTree.Node,
      ruleName: string,
      analysis: ComponentAnalysis,
      sourceCode: TSESLint.SourceCode
    ): TSESLint.RuleFix | null {
      switch (ruleName) {
        case 'useMemoForExpensiveCalculations':
          return createUseMemoFix(fixer, node, analysis, sourceCode);
        case 'useCallbackForEventHandlers':
          return createUseCallbackFix(fixer, node,sourceCode)
        default:
          return null;
      }
    }

    function createUseMemoFix(
      fixer: TSESLint.RuleFixer,
      node: TSESTree.Node,
      analysis: ComponentAnalysis,
      sourceCode: TSESLint.SourceCode
    ): TSESLint.RuleFix {
      const build = template.expression(`
        useMemo(() => { 
          return CALCULATION
        }, [DEPS])
      `);

      const newNode = build({
        CALCULATION: sourceCode.getText(node),
        DEPS: analysis.hooks.flatMap((h) => h.dependencies).join(', '),
      });

      return fixer.replaceText(node, sourceCode.getText(newNode as any));
    }

    function createUseCallbackFix(
      fixer: TSESLint.RuleFixer,
      node: TSESTree.Node,
      sourceCode: TSESLint.SourceCode
    ): TSESLint.RuleFix {
      return fixer.replaceText(node, sourceCode.getText(node as any));
    }

    return {
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(
        node:
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression
      ) {
        try {
          const nodePath = convertToNodePath(node);
          const analysis = analyzeComponent(
            nodePath,
            context.filename,
            analyzerConfig
          );

          defaultRules.forEach((rule) => {
            if (rule.test(analysis)) {
              const messageId = getRuleMessageId(rule.name);
              if (messageId) {
                context.report({
                  node,
                  messageId,
                  data: {
                    description: rule.suggestion(analysis),
                  },
                  fix(fixer) {
                    return createFix(
                      fixer,
                      node,
                      rule.name,
                      analysis,
                      context.getSourceCode()
                    );
                  },
                });
              }
            }
          });
        } catch (error) {
          // Silent fail for non-React components
        }
      },
    };
  },
});

function getRuleMessageId(ruleName: string): MessageIds | null {
  const messageIds: Record<string, MessageIds> = {
    useMemoForExpensiveCalculations: 'useMemoSuggestion',
    useCallbackForEventHandlers: 'useCallbackSuggestion',
    optimizeDependencyArrays: 'optimizeDependencySuggestion',
    preventUnnecessaryUpdates: 'preventUpdatesSuggestion',
  };
  return messageIds[ruleName] || null;
}
