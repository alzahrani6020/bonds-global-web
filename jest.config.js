module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    // These suites use Node's test runner and are exercised separately in CI.
    '<rootDir>/tests/hr/.*\\.test\\.cjs$'
  ]
};
