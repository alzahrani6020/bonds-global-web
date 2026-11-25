module.exports = {
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.vercel/',
    '<rootDir>/bonds-v2/',
    '<rootDir>/tests/hr/.*\.test\.cjs$', // Native Node tests run separately in CI via node --test
    '<rootDir>/tests/db/production-migration-reconciliation\.test\.cjs$', // Run separately in migration workflow
    '<rootDir>/tests/db/production-migration-api-runner\.test\.cjs$' // Native Node tests run in migration workflow
  ]
};
