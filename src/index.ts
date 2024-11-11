
import { reactHooksOptimization } from './rules/react-hooks-optimization';

// ESLint 플러그인은 이것만 있어야 합니다
module.exports = {
  rules: {
    'prefer-optimization': reactHooksOptimization
  }
};