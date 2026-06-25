// server/src/middleware/requestLogger.js
// Simple request logger middleware.

function requestLogger(req, res, next) {
    const start = Date.now();
    const ts = new Date().toISOString();

    console.log(`${ts} ${req.method} ${req.url}`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${ts} ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
    });

    next();
}

module.exports = { requestLogger };