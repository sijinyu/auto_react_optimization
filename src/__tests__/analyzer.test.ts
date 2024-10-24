import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { describe } from 'node:test';
import { analyzeComponent } from '../analyzer/componentAnalyzer';
describe('Component Analyzer', () => {
  it('should analyze a simple functional component', () => {
    const code = `
      function SimpleComponent({ name, age }: Props) {
        return <div>{name}: {age}</div>;
      }
    `;

    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        const analysis = analyzeComponent(path, 'test.tsx', {
          memoThreshold: { propsCount: 2, renderCount: 3 },
          performanceThreshold: {
            complexity: 5,
            arraySize: 100,
            computationWeight: 0.7,
          },
          ignorePatterns: [],
          customRules: [],
        });

        expect(analysis.name).toBe('SimpleComponent');
        expect(analysis.props).toHaveLength(2);
        expect(analysis.hooks).toHaveLength(0);
      },
    });
  });

  it('should analyze hooks usage', () => {
    const code = `
      function ComponentWithHooks({ data }: Props) {
        const [count, setCount] = useState(0);
        useEffect(() => {
          console.log(count);
        }, [count]);
        return <div>{count}</div>;
      }
    `;

    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        const analysis = analyzeComponent(path, 'test.tsx', {
          memoThreshold: { propsCount: 2, renderCount: 3 },
          performanceThreshold: {
            complexity: 5,
            arraySize: 100,
            computationWeight: 0.7,
          },
          ignorePatterns: [],
          customRules: [],
        });

        expect(analysis.hooks).toHaveLength(2);
        expect(analysis.hooks.map((h) => h.name)).toContain('useState');
        expect(analysis.hooks.map((h) => h.name)).toContain('useEffect');
      },
    });
  });
});
