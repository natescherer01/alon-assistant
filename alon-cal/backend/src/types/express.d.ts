/**
 * Express Type Extensions
 *
 * Extends Express Request interface to include custom properties
 */

import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}
