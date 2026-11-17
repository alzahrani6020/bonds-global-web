module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    // Node's built-in test runner executes these files in a separate CI step.
    '<rootDir>/tests/hr/.*\\.test\\.cjs
  ]
};

  ]
};
