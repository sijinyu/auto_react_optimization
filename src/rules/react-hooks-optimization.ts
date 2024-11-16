import { parse } from '@babel/parser';
import template from '@babel/template';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ESLintUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { analyzeComponent } from '../analyzer/componentAnalyzer';
import { defaultRules } from '../optimizer/rules';
import { AnalyzerConfig, ComponentAnalysis } from '../types';

type MessageIds = 'useMemoSuggestion' | 'useCallbackSuggestion';

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
    console.log('Rule is running with options:', options); // 로그 추가

    const analyzerConfig: AnalyzerConfig = {
      memoThreshold: options.memoThreshold,
      performanceThreshold: options.performanceThreshold,
    };

    function convertToNodePath(node: TSESTree.Node): NodePath<t.Node> {
      const code = context.sourceCode.getText(node);
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
          return createUseCallbackFix(fixer, node, sourceCode);
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
      const originalText = sourceCode.getText(node);

      // useMemo로 감싼 텍스트를 만듭니다
      const memoizedText = `
    useMemo(() => {
      return ${originalText};
    }, [${analysis.hooks.flatMap((h) => h.dependencies).join(', ')}])
  `;
      return fixer.replaceText(node, memoizedText);
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
        console.log('Found a function:', node.type); // 로그 추가

        try {
          const nodePath = convertToNodePath(node);
          const analysis = analyzeComponent(
            nodePath,
            context.filename,
            analyzerConfig
          );

          defaultRules.forEach((rule) => {
            console.log('Testing rule:', rule.name); // 로그 추가

            if (rule.test(analysis)) {
              console.log('Rule test passed:', rule.name); // 로그 추가

              const messageId = getRuleMessageId(rule.name);
              if (messageId) {
                console.log('Reporting issue with messageId:', messageId); // 로그 추가
                console.log('Report suggestion', rule.suggestion(analysis));

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
                      context.sourceCode
                    );
                  },
                });
              }
            }
          });
        } catch (error) {}
      },
    };
  },
});

function getRuleMessageId(ruleName: string): MessageIds | null {
  const messageIds: Record<string, MessageIds> = {
    useMemoForExpensiveCalculations: 'useMemoSuggestion',
    useCallbackForEventHandlers: 'useCallbackSuggestion',
  };
  return messageIds[ruleName] || null;
}
