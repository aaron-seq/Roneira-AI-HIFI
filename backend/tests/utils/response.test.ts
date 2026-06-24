import { Response } from 'express';
import { sendSuccess, sendError } from '../../src/utils/response';

describe('Response Utility', () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    // Mock the date to ensure deterministic timestamps in tests
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('sendSuccess', () => {
    it('should send a success response with status 200 by default', () => {
      const data = { message: 'test data' };

      sendSuccess(mockResponse as Response, data);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should send a success response with a custom status code', () => {
      const data = { message: 'created' };
      const statusCode = 201;

      sendSuccess(mockResponse as Response, data, statusCode);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should correctly handle null or undefined data', () => {
      sendSuccess(mockResponse as Response, null);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });
  });

  describe('sendError', () => {
    it('should send an error response with status 500 by default', () => {
      const errorMsg = 'Internal Server Error';

      sendError(mockResponse as Response, errorMsg);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: errorMsg,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should send an error response with a custom status code', () => {
      const errorMsg = 'Not Found';
      const statusCode = 404;

      sendError(mockResponse as Response, errorMsg, statusCode);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: errorMsg,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });
  });
});
