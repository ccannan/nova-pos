// server/src/middleware/errorHandler.js
// Global Express error handler. Returns structured JSON errors.

function errorHandler(err, req, res, _next) {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
    });

    const statusCode = err.statusCode || 500;
    const body = {
        error: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Internal server error',
    };

    if (err.fields) {
        body.fields = err.fields;
    }

    res.status(statusCode).json(body);
}

module.exports = { errorHandler };