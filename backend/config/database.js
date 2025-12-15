const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection by checking if we can access the database
const testConnection = async () => {
    const { data, error } = await supabase
        .from('erp_kunden')
        .select('code')
        .limit(1);

    if (error) {
        throw new Error(`Supabase connection failed: ${error.message}`);
    }
    return true;
};

// Compatibility wrapper for getPool (returns supabase client)
const getPool = async () => {
    await testConnection();
    return supabase;
};

const closePool = async () => {
    // Supabase client doesn't need explicit closing
    console.log('Supabase connection closed');
};

module.exports = {
    supabase,
    getPool,
    closePool,
    testConnection
};
