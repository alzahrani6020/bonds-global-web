module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    '<rootDir>/tests/hr/.*\\.test\\.cjs
  ]
};
, // Native Node tests run separately in CI via node --test
    '<rootDir>/tests/db/production-migration-reconciliation\\.test\\.cjs
  ]
};
 // Executed with node --test in migration workflow
  ]
};
