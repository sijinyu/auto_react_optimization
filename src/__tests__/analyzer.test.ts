import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { analyzeComponent } from "../analyzer/componentAnalyzer";
import { AnalyzerConfig } from "../types";

describe("Component Analyzer", () => {
  const defaultConfig: AnalyzerConfig = {
    memoThreshold: {
      propsCount: 2,
      renderCount: 3,
    },
    performanceThreshold: {
      complexity: 5,
      arraySize: 100,
      computationWeight: 0.7,
    },
    ignorePatterns: [],
    customRules: [],
  };

  test("should analyze a simple component with expensive calculation", () => {
    const code = `
      function ExpensiveComponent() {
        const result = new Array(1000).fill(0).map((_, i) => i * 2);
        
        return (
          <div>{result.join(',')}</div>
        );
      }
    `;

    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        const analysis = analyzeComponent(path, "test.tsx", defaultConfig);

        expect(analysis.name).toBe("ExpensiveComponent");
        expect(analysis.renderAnalysis.hasExpensiveOperations).toBe(true);
      },
    });
  });

  test("should analyze a component with event handlers", () => {
    const code = `
      function EventComponent() {
        const handleClick = () => {
          console.log('clicked');
        };
        
        return (
          <button onClick={handleClick}>
            Click me
          </button>
        );
      }
    `;

    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        const analysis = analyzeComponent(path, "test.tsx", defaultConfig);

        expect(analysis.name).toBe("EventComponent");
        expect(analysis.renderAnalysis.hasEventHandlers).toBe(true);
        expect(analysis.renderAnalysis.eventHandlers.length).toBe(1);
      },
    });
  });
  describe("Advanced Component Analysis", () => {
    test("should analyze nested components with prop passing", () => {
      const code = `
        function ParentComponent() {
          const handleClick = () => {
            console.log('clicked');
          };
  
          const data = new Array(1000).fill(0).map((_, i) => i * 2);
  
          return (
            <div>
              <ChildComponent 
                onClick={handleClick}
                data={data}
                onHover={() => console.log('hover')}
              />
            </div>
          );
        }
      `;

      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          const analysis = analyzeComponent(path, "test.tsx", defaultConfig);

          expect(analysis.name).toBe("ParentComponent");
          expect(analysis.renderAnalysis.hasChildComponents).toBe(true);
          expect(analysis.renderAnalysis.hasExpensiveOperations).toBe(true);
          expect(analysis.renderAnalysis.functionPropPassing).toBe(true);
        },
      });
    });

    test("should analyze components with hooks", () => {
      const code = `
        function HookComponent() {
          const [count, setCount] = useState(0);
          const [data, setData] = useState([]);
    
          useEffect(() => {
            const newData = heavyCalculation();
            setData(newData); // 실제로 setState 호출하는 부분
          }, []);
    
          useEffect(() => {
            console.log(count);
          });
    
          const handleClick = () => {
            setCount(prev => prev + 1); // 실제로 setState 호출하는 부분
          };
    
          return (
            <button onClick={handleClick}>
              Count: {count}
            </button>
          );
        }
    
        function heavyCalculation() {
          return new Array(1000).fill(0).map((_, i) => i * 2);
        }
      `;

      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          if (path.node.id?.name === "HookComponent") {
            const analysis = analyzeComponent(path, "test.tsx", defaultConfig);

            expect(analysis.hooks.length).toBe(4); // useState 2개, useEffect 2개
            expect(analysis.renderAnalysis.hasStateUpdates).toBe(true); // setState 호출 확인
            expect(analysis.renderAnalysis.hasEventHandlers).toBe(true); // 이벤트 핸들러 확인
          }
        },
      });
    });
  });
});
