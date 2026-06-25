// server/src/index.js
// NovaPOS Express server — entry point and app factory.
// Exported as a function so supertest tests can import it without
// triggering app.listen().

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

function createApp() {
    const app = express();

    // Middleware
    app.use(cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(requestLogger);

    // Health check
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
        });
    });

    // Root
    app.get('/', (_req, res) => {
        res.json({
            name: 'NovaPOS API',
            version: '1.0.0',
            status: 'running',
        });
    });

    // API routes
    app.use('/api/stores', require('./routes/stores'));
    app.use('/api/suppliers', require('./routes/suppliers'));
    app.use('/api/categories', require('./routes/categories'));
    app.use('/api/attrib-types', require('./routes/attribTypes'));
    app.use('/api/item-status', require('./routes/itemStatus'));
    app.use('/api/customers', require('./routes/customers'));
    app.use('/api/items', require('./routes/items'));
    app.use('/api/inventory', require('./routes/inventory'));
    app.use('/api/sales', require('./routes/sales'));

    // Error handler (must be last)
    app.use(errorHandler);

    return app;
}

// Start server only when run directly (not when imported by tests)
const app = createApp();
const PORT = process.env.PORT || 3001;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`NovaPOS API running on http://localhost:${PORT}`);
        console.log(`Health: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;