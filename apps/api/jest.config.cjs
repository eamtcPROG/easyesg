/** Jest + ts-jest per architecture.md §12.5.6 (OQ-16, closed). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // Jest resolves modules itself — tsconfig `paths` is invisible to it, so the alias is
  // restated here. Keep the two in agreement or specs fail on imports the build accepts.
  moduleNameMapper: { '^@api/(.*)$': '<rootDir>/$1' },
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  // Off unless `--coverage` is passed, which only `pnpm test:coverage` does (task 205):
  // `tools/check-coverage.mjs` reads the json-summary, and v8 is what the Vitest workspaces use,
  // so a line and a branch are counted the same way in both runners. `collectCoverageFrom` is
  // what makes a file no spec loads count as uncovered; spec files are excluded by Jest itself.
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  coverageProvider: 'v8',
  coverageReporters: ['json-summary', 'text-summary'],
  testEnvironment: 'node',
};
