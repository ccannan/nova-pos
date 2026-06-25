import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
}

export function errorHandler(
    error: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Log the error
    console.error('Error occurred:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });

    // Default error response
    const statusCode = error.statusCode || 500;
    const errorResponse: any = {
        error: true,
        message: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
        path: req.url
    };

    // Add error code if available
    if (error.code) {
        errorResponse.code = error.code;
    }

    // Don't expose stack traces in production
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
    }

    res.status(statusCode).json(errorResponse);
}