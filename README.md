# 🚀 eslint-plugin-react-optimization 🔧

`eslint-plugin-react-optimization` is an ESLint plugin that recommends using `useMemo` and `useCallback` to optimize React projects and reduce unnecessary re-renders. This plugin detects performance issues in the codebase and provides specific recommendations and autofixes to help developers achieve optimal performance.

## ✨ Key Features

- 🧠 **Recommend \*\*\*\*\*\***`useMemo`\*\*: Suggests using `useMemo` for expensive calculations that are repeated.
- 🖇️ **Recommend \*\*\*\*\*\***`useCallback`\*\*: Suggests using `useCallback` for event handlers passed to child components to prevent them from being re-created on every render.
- 🛠️ **Dependency Array Optimization**: Warns if necessary values are missing or unnecessary values are included in the dependency arrays of `useMemo` and `useCallback`.
- ⚠️ **Warning Levels**: Sets warning levels based on the importance of the suggestion, such as "essential" and "consideration" to help developers prioritize actions.

## 📦 Installation

### 🛠️ Setting Up as an ESLint Plugin

You can install `eslint-plugin-react-optimization` to use in your project.

```bash
npm install eslint-plugin-react-optimization --save-dev
```

Or, if you're using Yarn:

```bash
yarn add eslint-plugin-react-optimization --dev
```

Add the plugin to your ESLint configuration file. Here is an example of how to configure `.eslintrc.json`:

```json
{
  "plugins": ["react-optimization"],
  "rules": {
    "react-optimization/use-memo": "warn",
    "react-optimization/use-callback": "warn"
  }
}
```

## 🖥️ Running as a CLI Tool

`eslint-plugin-react-optimization` can also be used as a CLI tool. It provides the `react-optimizer` command to analyze project files and offer optimization suggestions.

### 📥 Installation

To use it as a CLI, install the package globally:

```bash
npm install -g eslint-plugin-react-optimization
```

### ▶️ Usage

After installing, run the following command from the project root directory to receive optimization suggestions:

```bash
react-optimizer --path ./src --config ./optimizer-config.json
```

🔍 **Option Descriptions**:

- 📂 `--path`: The directory path where the React components to be analyzed are located.
- ⚙️ `--config`: The configuration file to be used for optimization analysis.

## 📋 Rule Descriptions

### 🔄 `use-memo`

Detects repeated expensive calculations inside components and recommends using `useMemo` to memoize them.

- **Warning Conditions**: Repeated large array operations, complex calculations, etc.

### 🖇️ `use-callback`

Recommends using `useCallback` to prevent event handlers passed to child components from being re-created on each render.

- **Warning Conditions**: Event handlers passed to child components or involving complex operations.

## 🔧 Autofix

`eslint-plugin-react-optimization` provides autofixes for the recommended optimizations, making it easier to apply suggestions and improve perforation!

## 📜 License

This project is licensed under the MIT License.

## 👨‍💻 Author

This plugin was created by Sijin, who is passionate about frontend performance optimization. Hope this helps you write an optimized React codebase.
