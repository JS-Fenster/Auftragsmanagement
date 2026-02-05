/**
 * Work4All SQL Server Verbindung
 *
 * Verwendet Cloudflare Tunnel: sql.js-fenster-intern.org
 * Nur Lesezugriff auf dbo.Angebot, dbo.Positionen, etc.
 *
 * Erstellt: 2026-02-04
 */

const sql = require('mssql');
require('dotenv').config();

// W4A SQL Server Konfiguration via Cloudflare Tunnel
const w4aConfig = {
    server: process.env.W4A_DB_SERVER || 'sql.js-fenster-intern.org',
    port: parseInt(process.env.W4A_DB_PORT || '1433', 10),
    database: process.env.W4A_DB_DATABASE || 'WorkM001',
    user: process.env.W4A_DB_USER,
    password: process.env.W4A_DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 60000,
        requestTimeout: 60000
    },
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Connection Pool
let w4aPool = null;

/**
 * Holt oder erstellt den W4A Connection Pool
 * @returns {Promise<sql.ConnectionPool>}
 */
const getW4APool = async () => {
    if (w4aPool && w4aPool.connected) {
        return w4aPool;
    }

    // Pruefe ob Credentials vorhanden
    if (!w4aConfig.user || !w4aConfig.password) {
        throw new Error('W4A_DB_USER und W4A_DB_PASSWORD muessen in .env gesetzt sein');
    }

    try {
        w4aPool = await sql.connect(w4aConfig);
        console.log('[W4A] SQL Server Verbindung hergestellt');
        return w4aPool;
    } catch (error) {
        console.error('[W4A] Verbindungsfehler:', error.message);
        throw error;
    }
};

/**
 * Schliesst den W4A Connection Pool
 */
const closeW4APool = async () => {
    if (w4aPool) {
        try {
            await w4aPool.close();
            w4aPool = null;
            console.log('[W4A] SQL Server Verbindung geschlossen');
        } catch (error) {
            console.error('[W4A] Fehler beim Schliessen:', error.message);
        }
    }
};

/**
 * Health Check fuer W4A Verbindung
 * @returns {Promise<{connected: boolean, latency_ms: number, error?: string}>}
 */
const checkW4AHealth = async () => {
    const startTime = Date.now();
    try {
        const pool = await getW4APool();
        const result = await pool.request().query('SELECT 1 AS test');
        const latency = Date.now() - startTime;
        return {
            connected: true,
            latency_ms: latency,
            server: w4aConfig.server,
            database: w4aConfig.database
        };
    } catch (error) {
        return {
            connected: false,
            latency_ms: Date.now() - startTime,
            error: error.message,
            server: w4aConfig.server,
            database: w4aConfig.database
        };
    }
};

module.exports = {
    sql,
    getW4APool,
    closeW4APool,
    checkW4AHealth,
    w4aConfig
};
