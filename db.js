require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
    if (err) console.error("❌ Connection Error:", err);
    else console.log("✅ Connected to NEW Supabase Project!");
});

module.exports = { query: (text, params, cb) => pool.query(text, params, cb) };