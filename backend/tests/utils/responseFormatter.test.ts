// @ts-nocheck
import { createApiResponse } from '../../src/utils/responseFormatter';

describe('responseFormatter', () => {
  describe('createApiResponse', () => {
    it('should format a basic response correctly', () => {
      const response = createApiResponse({ id: 1 }, true);
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1 });
      expect(response).toHaveProperty('timestamp');
      expect(response).not.toHaveProperty('message');
      expect(response).not.toHaveProperty('metadata');
    });

    it('should include metadata when provided', () => {
      const metadata = { page: 1, limit: 10 };
      const response = createApiResponse({ id: 1 }, true, null, metadata);
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1 });
      expect(response).toHaveProperty('timestamp');
      expect(response).not.toHaveProperty('message');
      expect(response.metadata).toEqual(metadata);
    });

    it('should include message when provided', () => {
      const response = createApiResponse({ id: 1 }, true, 'Success');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1 });
      expect(response).toHaveProperty('timestamp');
      expect(response.message).toBe('Success');
      expect(response).not.toHaveProperty('metadata');
    });

    it('should use default arguments properly when not provided', () => {
      const response = createApiResponse();
      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
      expect(response).toHaveProperty('timestamp');
      expect(response).not.toHaveProperty('message');
      expect(response).not.toHaveProperty('metadata');
    });
  });
});
