const fs = require("fs");
const path = require("path");
const db = require("./db");

// folder path
const migrationsDir = path.join(__dirname, "migrations");

// read all .sql files
const files = fs.readdirSync(migrationsDir);

files.forEach(file => {
    if (file.endsWith(".sql")) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        console.log(`Running migration: ${file}`);

        db.query(sql, (err) => {
            if (err) {
                console.error(`Migration failed: ${file}`, err);
            } else {
                console.log(`Migration successful: ${file}`);
            }
        });
    }
});
