/**
 * Logger Mock
 *
 * Mock logger to prevent console noise during tests
 */

export const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

export default loggerMock;
