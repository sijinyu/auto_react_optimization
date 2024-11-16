# 🚀 eslint-plugin-react-hooks-optimization 🔧

`eslint-plugin-react-hooks-optimization` is an ESLint plugin that recommends using `useMemo` and `useCallback` to optimize React projects and reduce unnecessary re-renders. This plugin detects performance issues in the codebase and provides specific recommendations and to help developers achieve optimal performance.

## ✨ Key Features

- 🧠 **useMemo Optimization**: Detects expensive calculations and suggests memoization
- 🖇️ **useCallback Optimization**: Identifies event handlers that should be memoized

## 📦 Installation

```bash
npm install eslint-plugin-react-hooks-optimization --save-dev
# or
yarn add eslint-plugin-react-hooks-optimization --dev
```

## Configuration

Add to your ESLint configuration file (.eslintrc.json):

```json
{
  "plugins": ["react-hooks-optimization"],
  "rules": {
    "react-hooks-optimization/prefer-optimization": [
      "warn",
      {
        "memoThreshold": {
          "propsCount": 2, // Minimum props count to suggest memoization
          "renderCount": 3 // Re-render count threshold
        },
        "performanceThreshold": {
          "complexity": 5, // Code complexity threshold
          "arraySize": 100, // Array size threshold
          "computationWeight": 0.7 // Computation cost weight
        }
      }
    ]
  }
}
```

## 🎯 Optimization Criteria

useMemo Suggestions
The plugin suggests useMemo when it detects:

Complex Calculations

Nested loops (exponential complexity)
High cyclomatic complexity (> 5)
Multiple mathematical operations

Large Array Operations

Arrays with more than 100 elements
Chained array methods (.map, .filter, .reduce)
Complex array transformations

```jsx
// Will suggest useMemo:
const processedData = data.map((item) => {
  return otherData.filter((other) => {
    return complex_calculation(item, other);
  });
});

const largeArray = new Array(1000).fill(0).map(complex_transformation);
```

useCallback Suggestions
The plugin suggests useCallback for functions that:

Are Passed as Props

Event handlers passed to child components
Callback functions used in effects

Contain State Updates

Functions that call setState
Functions that trigger effects

```jsx
// Will suggest useCallback:
const handleUpdate = () => {
  setCount((prev) => prev + 1);
  onDataChange(newValue); // prop function
};

<ChildComponent onUpdate={handleUpdate} />;
```

## 📋 Example Use Cases

Complex Data Processing

```jsx
// Before
function DataProcessor({ data }) {
  const processed = data
    .filter(complexFilter)
    .map(complexTransform)
    .reduce(complexReduce);

  return <Display data={processed} />;
}

// After (with optimization)
function DataProcessor({ data }) {
  const processed = useMemo(
    () =>
      data.filter(complexFilter).map(complexTransform).reduce(complexReduce),
    [data]
  );

  return <Display data={processed} />;
}
```

## 📜 License

MIT License

## 👨‍💻 Author

Created by Sijin
