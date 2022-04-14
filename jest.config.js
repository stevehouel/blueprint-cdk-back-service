module.exports = {
  roots: [
    '<rootDir>/test',
    '<rootDir>/lib/api'
  ],
  testMatch: [ '**/*.test.ts' ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
