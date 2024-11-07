import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import {
  AnalyzerConfig,
  ChildComponent,
  EventHandler,
  RenderAnalysis,
} from "../types";
import { HOOK_TYPES, isHook, isSpecificHook } from "../utils/astUtils";
import { isStateUpdate } from "./hooks";


export function analyzeRenderingBehavior(
  path: NodePath,
  config: AnalyzerConfig
): RenderAnalysis {
  let hasChildComponents = false;
  let hasPropsPassingToChild = false;

  path.traverse({
    JSXElement(jsxPath) {
      const openingElement = jsxPath.node.openingElement;
      const elementName = openingElement.name;

      // 대문자로 시작하는 컴포넌트 이름 체크
      if (
        t.isJSXIdentifier(elementName) &&
        elementName.name[0] === elementName.name[0].toUpperCase()
      ) {
        hasChildComponents = true;

        openingElement.attributes.forEach(attr => {
          if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
            const attrName = attr.name.name; // name 프로퍼티의 실제 문자열 값
            const value = attr.value;
            
            if (t.isJSXExpressionContainer(value)) {
              const expression = value.expression;
              if (t.isFunction(expression) || 
                  (t.isIdentifier(expression) && 
                   (attrName.startsWith('handle') || 
                    attrName.startsWith('on')))) {
                hasPropsPassingToChild = true;
              }
            }
          }
        });
      }
    },
  });

  const analysis: RenderAnalysis = {
    estimatedRenderCount: calculateEstimatedRenderCount(path),
    hasExpensiveCalculations: checkForExpensiveCalculations(path, config),
    hasExpensiveOperations: checkForExpensiveOperations(path, config),
    affectedByStateChanges: checkForStateChanges(path),
    eventHandlers: findEventHandlers(path),
    hasEventHandlers: false,
    hasChildComponents: hasChildComponents && hasPropsPassingToChild,
    memoizedComponents: findMemoizedComponents(path),
    functionPropPassing: false,
    hasStateUpdates: false,
  };

  // 부가 정보 설정
  analysis.hasEventHandlers = analysis.eventHandlers.length > 0;
analysis.functionPropPassing = checkForFunctionPropPassing(path);
  analysis.hasStateUpdates = checkForStateUpdates(path);

  return analysis;
}

function calculateEstimatedRenderCount(path: NodePath): number {
  let count = 1; // 초기 렌더링

  path.traverse({
    CallExpression(callPath) {
      const node = callPath.node;
      if (!isHook(node)) return;

      if (isSpecificHook(node, HOOK_TYPES.STATE)) {
        count += 2; // setState 호출 가능성
      } else if (isSpecificHook(node, HOOK_TYPES.EFFECT)) {
        count += 1; // effect 재실행 가능성
      }
    },
  });

  return count;
}

function checkForExpensiveCalculations(
  path: NodePath,
  config: AnalyzerConfig
): boolean {
  let found = false;
  const threshold = config.performanceThreshold.complexity;

  path.traverse({
    ForStatement(forPath) {
      if (calculateLoopComplexity(forPath) > threshold) {
        found = true;
      }
    },
    WhileStatement(whilePath) {
      if (calculateLoopComplexity(whilePath) > threshold) {
        found = true;
      }
    },
  });

  return found;
}

function checkForExpensiveOperations(
  path: NodePath,
  config: AnalyzerConfig
): boolean {
  let found = false;
  const arrayThreshold = config.performanceThreshold.arraySize;

  path.traverse({
    // 1. 변수 선언 체크
    VariableDeclarator(declaratorPath) {
      const init = declaratorPath.get('init');
      if (!init) return;

      if (checkForArrayOperations(init as NodePath)) {
        if (!isMemoized(declaratorPath)) {
          found = true;
        }
      }
    },

    // 2. 함수 표현식 및 화살표 함수 반환 값 체크
    ArrowFunctionExpression(arrowPath) {
      const body = arrowPath.get('body');

      if (checkForArrayOperations(body)) {
        if (!isMemoized(arrowPath)) {
          found = true;
        }
      }
    },

    // 3. 일반 함수 선언에서 내부의 배열 생성 여부 탐지
    FunctionDeclaration(funcPath) {
      funcPath.traverse({
        CallExpression(callPath) {
          if (checkForArrayOperations(callPath)) {
            if (!isMemoized(callPath)) {
              found = true;
            }
          }
        },
        NewExpression(newPath) {
          if (checkForArrayOperations(newPath)) {
            if (!isMemoized(newPath)) {
              found = true;
            }
          }
        },
      });
    },

    // 4. 함수 표현식에서도 배열 생성 및 메서드 사용 체크
    FunctionExpression(funcExprPath) {
      funcExprPath.traverse({
        CallExpression(callPath) {
          if (checkForArrayOperations(callPath)) {
            if (!isMemoized(callPath)) {
              found = true;
            }
          }
        },
        NewExpression(newPath) {
          if (checkForArrayOperations(newPath)) {
            if (!isMemoized(newPath)) {
              found = true;
            }
          }
        },
      });
    },
  });

  return found;

  // Helper 함수: 배열 연산 여부 체크
  function checkForArrayOperations(nodePath: NodePath): boolean {
    if (nodePath.isCallExpression() || nodePath.isNewExpression()) {
      const calleeNode = nodePath.node.callee;

      // new Array() 패턴 체크
      if (
        nodePath.isNewExpression() &&
        t.isIdentifier(calleeNode, { name: 'Array' })
      ) {
        const args = nodePath.get('arguments');
        if (Array.isArray(args) && args.length > 0) {
          const firstArg = args[0];
          if (firstArg.isNumericLiteral()) {
            const arraySize = firstArg.node.value;
            if (arraySize > arrayThreshold) {
              return true;
            }
          }
        }
      }

      // Array.from() 체크
      if (
        nodePath.isCallExpression() &&
        t.isMemberExpression(calleeNode) &&
        t.isIdentifier(calleeNode.object, { name: 'Array' }) &&
        t.isIdentifier(calleeNode.property, { name: 'from' })
      ) {
        const args = nodePath.get('arguments');
        if (Array.isArray(args) && args.length > 0) {
          const firstArg = args[0];
          if (firstArg.isNumericLiteral()) {
            const arraySize = firstArg.node.value;
            if (arraySize > arrayThreshold) {
              return true;
            }
          }
        }
      }

      // 배열 메서드 체인 체크
      if (
        t.isMemberExpression(calleeNode) &&
        isArrayMethod(calleeNode.property as t.Expression)
      ) {
        const objectPath = nodePath.get('callee.object');
        if (Array.isArray(objectPath)) {
          for (const objPath of objectPath) {
            if (checkForArrayOperations(objPath)) {
              return true;
            }
          }
        } else if (checkForArrayOperations(objectPath)) {
          return true;
        }
      }
    }

    // Arrow Function이 배열 연산을 반환하는 경우
    if (nodePath.isArrowFunctionExpression()) {
      const body = nodePath.get('body');
      if (checkForArrayOperations(body)) {
        return true;
      }
    }

    return false;
  }

  // Helper 함수: 노드가 useMemo로 감싸졌는지 확인
  function isMemoized(nodePath: NodePath | null): boolean {
    if (!nodePath) return false;

    let currentPath: NodePath | null = nodePath;
    while (currentPath) {
      if (currentPath.isCallExpression()) {
        const callee = currentPath.get('callee');
        if (callee.isIdentifier({ name: 'useMemo' })) {
          return true;
        }
      }
      currentPath = currentPath.parentPath;
    }

    return false;
  }

  // Helper 함수: 배열 메서드 식별
  function isArrayMethod(propertyNode: t.Expression): boolean {
    return (
      t.isIdentifier(propertyNode) &&
      ['map', 'filter', 'reduce', 'forEach', 'fill'].includes(
        propertyNode.name
      )
    );
  }
}
// function checkForExpensiveOperations(
//   path: NodePath,
//   config: AnalyzerConfig
// ): boolean {
//   let found = false;
//   const arrayThreshold = config.performanceThreshold.arraySize;

//   path.traverse({
//     // 2. 변수 선언 체크
//     VariableDeclarator(declaratorPath) {
//       const init = declaratorPath.get('init');
//       if (!init || Array.isArray(init)) return;

//       const arraySize = getArraySize(init as NodePath);
//       if (arraySize > arrayThreshold) {
//         found = true;
//       }

//       // 배열에 대해 map, filter 등이 사용되는지 체크
//       if (t.isCallExpression(init.node)) {
//         const callee = init.node.callee;
//         if (isArrayMethod(callee)) {
//           found = true;
//         }
//       }
//     },

    
//     // 함수 선언 내부의 배열 연산 체크
//     ArrowFunctionExpression(arrowPath) {
//       const body = arrowPath.get('body');
//       if (!Array.isArray(body)) {
//         const arraySize = getArraySize(body);
//         if (arraySize > arrayThreshold) {
//           found = true;
//         }

//         // 배열의 map, filter 등이 함수 내부에서 사용되는지 체크
//         body.traverse({
//           CallExpression(callPath) {
//             const callee = callPath.get('callee');
//             if (callee.isMemberExpression() && isArrayMethod(callee.node)) {
//               const arraySize = getArraySize(callPath);
//               if (arraySize > arrayThreshold) {
//                 found = true;
//               }
//             }
//           },
//         });
//       }
//     },
//   });

//   return found;
// }

// function isArrayMethod(callee: t.Node): boolean {
//   if (t.isMemberExpression(callee)) {
//     if (
//       t.isIdentifier(callee.property) &&
//       ['map', 'filter', 'reduce', 'forEach'].includes(callee.property.name)
//     ) {
//       return true;
//     }
//   }
//   return false;
// }


function getArraySize(path: NodePath): number {
  if (path.isCallExpression()) {
    const callee = path.node.callee;

    // new Array() 패턴 체크
    if (t.isNewExpression(callee)) {
      if (t.isIdentifier(callee.callee) && callee.callee.name === 'Array') {
        const sizeArg = callee.arguments[0];
        if (t.isNumericLiteral(sizeArg)) {
          return sizeArg.value;
        }
      }
    }

    // map, filter 등의 메서드 체인 체크
    if (t.isMemberExpression(callee)) {
      const object = callee.object;
      if (t.isCallExpression(object)) {
        return getArraySize(path.get('callee.object') as NodePath);
      }
    }
  }

  return 0;
}


function findEventHandlers(path: NodePath): EventHandler[] {
  const handlers: EventHandler[] = [];
  
  // 모든 변수 선언을 순회
  path.traverse({
    VariableDeclarator(declaratorPath) {
      // 1. 핸들러 함수 식별
      
      const id = declaratorPath.get('id');
      if (!id.isIdentifier()) return;
      
      const handlerName = id.node.name;
      if (!handlerName.startsWith('handle') && !handlerName.startsWith('on')) return;

      // 2. 함수 정의 확인
      const init = declaratorPath.get('init');
      if (Array.isArray(init)) return;

      // 3. useCallback 확인
      const parentNode = declaratorPath.parentPath?.parentPath?.node;
      const isCallbackWrapped = t.isCallExpression(parentNode) && 
                              t.isIdentifier(parentNode.callee) && 
                              parentNode.callee.name === 'useCallback';
      
      if (!isCallbackWrapped) {
        // 4. JSX 속성으로 전달되는지 확인
        let isPassedToJSX = false;
        path.traverse({
          JSXAttribute(jsxAttrPath) {
            if (t.isJSXIdentifier(jsxAttrPath.node.name) &&
                jsxAttrPath.node.value && 
                t.isJSXExpressionContainer(jsxAttrPath.node.value) &&
                t.isIdentifier(jsxAttrPath.node.value.expression) &&
                jsxAttrPath.node.value.expression.name === handlerName) {
              isPassedToJSX = true;
            }
          }
        });

        // 5. 핸들러가 JSX props로 전달되면 추가
        if (isPassedToJSX) {
          handlers.push({
            name: handlerName,
            type: 'custom',
            usesProps: true,
            usesState: true,
            hasCleanup: false
          });
        }
      }
    }
    
  });

  return handlers;
}

function findMemoizedComponents(path: NodePath): ChildComponent[] {
  const components: ChildComponent[] = [];
  const processedComponents = new Set<string>();

  path.traverse({
    CallExpression(callPath) {
      const node = callPath.node;
      if (!t.isMemberExpression(node.callee)) return;

      const object = node.callee.object;
      const property = node.callee.property;

      if (
        t.isIdentifier(object) &&
        object.name === "React" &&
        t.isIdentifier(property) &&
        property.name === "memo"
      ) {
        const componentInfo = analyzeMemoizedComponent(callPath);
        if (componentInfo && !processedComponents.has(componentInfo.name)) {
          components.push(componentInfo);
          processedComponents.add(componentInfo.name);
        }
      }
    },
  });

  return components;
}

function calculateLoopComplexity(path: NodePath): number {
  let complexity = 1;
  let nestedLoops = 0;

  path.traverse({
    "ForStatement|WhileStatement|DoWhileStatement"() {
      nestedLoops++;
    },
  });

  return complexity * Math.pow(2, nestedLoops);
}


function estimateArraySize(path: NodePath<t.CallExpression>): number {
  const node = path.node;
  
  if (t.isCallExpression(node)) {
    // new Array(n) 생성자 체크
    if (t.isNewExpression(node.callee) && 
        t.isIdentifier(node.callee.callee) && 
        node.callee.callee.name === 'Array') {
      const args = node.callee.arguments;
      if (args.length > 0 && t.isNumericLiteral(args[0])) {
        return args[0].value;
      }
    }

    // 메서드 체인에서 원본 배열 크기 찾기
    if (t.isMemberExpression(node.callee)) {
      const object = node.callee.object;
      if (t.isCallExpression(object)) {
        const size = estimateArraySize(path.get('callee.object') as NodePath<t.CallExpression>);
        if (size > 0) return size;
      }
    }
  }

  return 0;
}
 
function checkForStateChanges(path: NodePath): boolean {
  let found = false;

  path.traverse({
    CallExpression(callPath: NodePath<t.CallExpression>) {
      if (isStateUpdate(callPath)) {
        found = true;
      }
    },
  });

  return found;
}

// React.memo 컴포넌트 분석
function analyzeMemoizedComponent(
  path: NodePath<t.CallExpression>
): ChildComponent | null {
  const arg = path.node.arguments[0];
  if (
    !t.isIdentifier(arg) &&
    !t.isFunctionExpression(arg) &&
    !t.isArrowFunctionExpression(arg)
  ) {
    return null;
  }

  return {
    name: t.isIdentifier(arg) ? arg.name : "AnonymousMemoComponent",
    isMemoized: true,
    receivedFunctions: findReceivedFunctions(path),
  };
}

// 컴포넌트가 받는 함수형 props 찾기
function findReceivedFunctions(path: NodePath): string[] {
  const functions: string[] = [];

  path.traverse({
    JSXAttribute(attrPath) {
      const value = attrPath.node.value;
      if (
        t.isJSXExpressionContainer(value) &&
        t.isIdentifier(value.expression) &&
        isFunctionType(value.expression, path)
      ) {
        functions.push((attrPath.node.name as t.JSXIdentifier).name);
      }
    },
  });

  return functions;
}

// 함수형 prop인지 체크
function isFunctionType(identifier: t.Identifier, path: NodePath): boolean {
  const binding = path.scope.getBinding(identifier.name);
  if (!binding) return false;

  const bindingPath = binding.path;
  return (
    bindingPath.isFunctionDeclaration() ||
    (bindingPath.isVariableDeclarator() &&
      (t.isFunctionExpression(bindingPath.node.init) ||
        t.isArrowFunctionExpression(bindingPath.node.init)))
  );
}

// 함수형 props 전달 체크
function checkForFunctionPropPassing(path: NodePath): boolean {
  let passesFunctions = false;

  path.traverse({
    JSXAttribute(attrPath) {
      const value = attrPath.node.value;
      if (!t.isJSXExpressionContainer(value)) return;

      const expression = value.expression;
      if (t.isJSXEmptyExpression(expression)) return;

      if (
        t.isFunction(expression) ||
        (t.isIdentifier(expression) && isFunctionType(expression, path))
      ) {
        const parentCall = getParentCallExpression(attrPath);
        if (!parentCall || !isHook(parentCall)) {
          passesFunctions = true;
        }
      }
    },
  });

  return passesFunctions;
}

// 상태 업데이트 체크
function checkForStateUpdates(path: NodePath): boolean {
  let hasStateUpdates = false;
  // useState 호출 추적을 위한 Set
  const stateSetters = new Set<string>();

  // 먼저 useState 호출을 찾아서 setter 함수들을 수집
  path.traverse({
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isIdentifier(callee) && callee.name === "useState") {
        const parent = callPath.parentPath;
        if (
          parent?.isVariableDeclarator() &&
          t.isArrayPattern(parent.node.id)
        ) {
          const setter = parent.node.id.elements[1];
          if (t.isIdentifier(setter)) {
            stateSetters.add(setter.name);
          }
        }
      }
    },
  });

  // 그 다음 setter 함수들의 호출을 찾음
  path.traverse({
    CallExpression(callPath) {
      const callee = callPath.node.callee;
      if (t.isIdentifier(callee) && stateSetters.has(callee.name)) {
        hasStateUpdates = true;
      }
    },
    // setState 메서드 호출도 체크
    MemberExpression(memberPath) {
      if (
        t.isIdentifier(memberPath.node.property) &&
        memberPath.node.property.name === "setState"
      ) {
        hasStateUpdates = true;
      }
    },
  });

  return hasStateUpdates;
}

// 부모 CallExpression 노드 가져오기
function getParentCallExpression(
  path: NodePath
): NodePath<t.CallExpression> | null {
  let current: NodePath | null = path;
  while (current) {
    if (current.isCallExpression()) {
      return current as NodePath<t.CallExpression>;
    }
    current = current.parentPath;
  }
  return null;
}
