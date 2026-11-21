module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    // Native node:test suites are executed explicitly by HR CI, not by Jest.
    '<rootDir>/tests/hr/.*\\.test\\.cjs$'
  ]
};
