// client/src/test-setup.js
//
// Loaded via vite.config.js -> test.setupFiles. Extends Vitest's expect with
// the @testing-library/jest-dom matchers (toBeInTheDocument, toBeDisabled,
// toHaveValue, etc.) used throughout the test suite.

import '@testing-library/jest-dom';
