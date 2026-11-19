module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    // node:test suites run explicitly with Node's native test runner.
    '<rootDir>/tests/hr/.*[.]test[.]cjs$'
  ]
};
