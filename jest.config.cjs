/** Jest 配置：单元测试（service / guard / repository 层），覆盖率报告输出至 artifacts/coverage */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    // 纯声明式文件（模块装配、DTO 装饰器、类型定义、启动装配）不含可测逻辑
    '!src/main.ts',
    '!src/setup-app.ts',
    '!src/**/*.module.ts',
    '!src/**/dto/**',
    '!src/**/types/**',
    '!src/**/entities/**',
  ],
  coverageDirectory: 'artifacts/coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 65,
      functions: 70,
      lines: 75,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
