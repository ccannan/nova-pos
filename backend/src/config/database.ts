import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config: sql.config = {
    server: process.env.DB_HOST || 'localhost\\SQLEXPRESS',
    database: process.env.DB_NAME || 'NovaPOS',
    options: {
        trustServerCertificate: true,
        encrypt: false
    },
    authentication: {
        type: 'ntlm',
        options: {
            domain: '',
            userName: '',
            password: ''
        }
    }
};

let pool: sql.ConnectionPool | null = null;

export async function getDbPool(): Promise<sql.ConnectionPool> {
    if (!pool) {
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('Connected to NovaPOS database');
    }
    return pool;
}

export async function closeDb(): Promise<void> {
    if (pool) {
        await pool.close();
        pool = null;
        console.log('Database connection closed');
    }
}

// Helper function for queries
export async function queryDb(query: string, params?: Record<string, any>): Promise<sql.IResult<any>> {
    const pool = await getDbPool();
    const request = pool.request();
    
    // Add parameters if provided
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
        });
    }
    
    return await request.query(query);
}