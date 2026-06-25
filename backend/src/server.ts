import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDbPool, closeDb } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Simple health check without DB for now
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'not_connected',
            message: 'Server is running'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// API routes will go here
// app.use('/api/stores', storesRouter);
// app.use('/api/suppliers', suppliersRouter);
// app.use('/api/categories', categoriesRouter);
// app.use('/api/items', itemsRouter);
// app.use('/api/inventory', inventoryRouter);
// app.use('/api/customers', customersRouter);
// app.use('/api/sales', salesRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'NovaPOS API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Graceful shutdown...');
    await closeDb();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    await closeDb();
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        // Test database connection on startup
        // await getDbPool();
        
        app.listen(PORT, () => {
            console.log(`NovaPOS API server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();