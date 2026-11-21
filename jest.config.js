module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    // These suites use node:test and are executed explicitly by the HR CI step.
    '<rootDir>/tests/hr/.*\\.test\\.cjs
  ]
};

  ]
};
