// server.js (FINAL Supabase Storage Version)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); // NEW: Import Supabase Client

// shared DB connection (must use 'pg' driver)
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
// NOTE: We no longer serve '/uploads' because files are now in Supabase Storage

// --- Supabase Storage Setup ---
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Render Environment Variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
// --- End Supabase Storage Setup ---

// ---------------- STORAGE FOR MEDIA (Memory Only) ----------------
// We use memory storage to hold the file temporarily in RAM before sending to Supabase.
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// ---------------- GLOBAL ERROR HANDLER (Catches Multer Errors) ----------------
app.use(function (err, req, res, next) {
    if (err instanceof multer.MulterError) {
        console.error("MULTER ERROR:", err.message);
        return res.status(400).json({ status: 'error', message: 'File upload failed: ' + err.message });
    }
    if (err) {
        console.error("CRITICAL SERVER ERROR:", err);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
    next();
});
// ---------------- END GLOBAL ERROR HANDLER ----------------

// ---------------- HELPERS ----------------
function sendError(res, err, label = 'server_error') {
    console.error(label, err);
    return res.status(500).json({ status: 'error', error: err && err.message ? err.message : err });
}

// ---------------- STEP 1 ----------------
app.post('/save-step1', (req, res) => {
    const { listing_id, property_title, description, property_type, bedrooms, bathrooms, total_area } = req.body;
    if (!listing_id) return res.status(400).json({ status: 'error', message: 'listing_id missing' });

    const sql = `
        INSERT INTO step1 (listing_id, property_title, description, property_type, bedrooms, bathrooms, total_area)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (listing_id) DO UPDATE SET 
          property_title = EXCLUDED.property_title,
          description = EXCLUDED.description,
          property_type = EXCLUDED.property_type,
          bedrooms = EXCLUDED.bedrooms,
          bathrooms = EXCLUDED.bathrooms,
          total_area = EXCLUDED.total_area
    `;

    db.query(sql, [listing_id, property_title, description, property_type, bedrooms, bathrooms, total_area], (err, result) => {
        if (err) return sendError(res, err, 'STEP1_ERROR');
        res.json({ status: 'success' });
    });
});

// ---------------- STEP 2 ----------------
app.post('/add-step2', (req, res) => {
    const listing_id = req.body.listing_id;
    if (!listing_id) return res.status(400).json({ status: 'error', message: 'listing_id missing' });

    const {
        wifi = 0, tv = 0, ac = 0, heating = 0, washer = 0, dryer = 0,
        refrigerator = 0, stove = 0, microwave = 0, coffee_maker = 0, dishwasher = 0,
        smoke_alarm = 0, co_alarm = 0, first_aid = 0, fire_extinguisher = 0,
        unique_features = '', special_notes = ''
    } = req.body;

    const sql = `
        INSERT INTO step2 (listing_id, wifi, tv, ac, heating, washer, dryer,
          refrigerator, stove, microwave, coffee_maker, dishwasher,
          smoke_alarm, co_alarm, first_aid, fire_extinguisher,
          unique_features, special_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (listing_id) DO UPDATE SET 
          wifi=EXCLUDED.wifi, tv=EXCLUDED.tv, ac=EXCLUDED.ac, heating=EXCLUDED.heating,
          washer=EXCLUDED.washer, dryer=EXCLUDED.dryer, refrigerator=EXCLUDED.refrigerator,
          stove=EXCLUDED.stove, microwave=EXCLUDED.microwave, coffee_maker=EXCLUDED.coffee_maker,
          dishwasher=EXCLUDED.dishwasher, smoke_alarm=EXCLUDED.smoke_alarm, co_alarm=EXCLUDED.co_alarm,
          first_aid=EXCLUDED.first_aid, fire_extinguisher=EXCLUDED.fire_extinguisher,
          unique_features=EXCLUDED.unique_features, special_notes=EXCLUDED.special_notes
    `;

    db.query(sql, [listing_id, wifi, tv, ac, heating, washer, dryer,
        refrigerator, stove, microwave, coffee_maker, dishwasher,
        smoke_alarm, co_alarm, first_aid, fire_extinguisher,
        unique_features, special_notes
    ], (err, result) => {
        if (err) return sendError(res, err, 'STEP2_ERROR');
        res.json({ status: 'success' });
    });
});

// ---------------- STEP 3 ----------------
app.post('/add-step3', (req, res) => {
    const { listing_id, price, city, area } = req.body;
    if (!listing_id) return res.status(400).json({ status: 'error', message: 'listing_id missing' });

    const sql = `
        INSERT INTO step3 (listing_id, price, city, area)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (listing_id) DO UPDATE SET price = EXCLUDED.price, city = EXCLUDED.city, area = EXCLUDED.area
    `;

    db.query(sql, [listing_id, price, city, area], (err, result) => {
        if (err) return sendError(res, err, 'STEP3_ERROR');
        res.json({ status: 'success' });
    });
});

// ---------------- UPLOAD MEDIA (NEW: Supabase Storage) ----------------
app.post('/upload-media', upload.fields([
    { name: 'image1' }, { name: 'image2' }, { name: 'image3' }, { name: 'image4' }, { name: 'video' }
]), async (req, res) => {
    const listing_id = req.body.listing_id;
    if (!listing_id) return res.status(400).json({ status: 'error', message: 'listing_id missing' });

    let db_data = { listing_id, image1: null, image2: null, image3: null, image4: null, video: null };
    let upload_promises = [];

    // 1. Process files and push to Supabase Storage
    for (let i = 1; i <= 4; i++) {
        const fileKey = `image${i}`;
        const fileArr = req.files[fileKey];

        if (fileArr && fileArr.length > 0) {
            const file = fileArr[0];
            const filename = `${listing_id}/${fileKey}-${Date.now()}${path.extname(file.originalname)}`;

            const promise = supabase.storage
                .from('listing_images') // Must match the bucket name you created
                .upload(filename, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true,
                    cacheControl: '3600'
                })
                .then(({ data, error }) => {
                    if (error) throw new Error('Supabase Storage Error: ' + error.message);
                    db_data[fileKey] = data.path; // Store path/filename in DB
                });
            upload_promises.push(promise);
        }
    }
    
    // Video logic here if necessary
    
    try {
        // Wait for all files to finish uploading to Supabase Storage
        await Promise.all(upload_promises);

        // 2. Save metadata (filenames) to PostgreSQL database
        const sql = `
            INSERT INTO upload (listing_id, image1, image2, image3, image4, video)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (listing_id) DO UPDATE SET 
              image1 = EXCLUDED.image1, image2 = EXCLUDED.image2, image3 = EXCLUDED.image3,
              image4 = EXCLUDED.image4, video = EXCLUDED.video
        `;

        await db.query(sql, [
            listing_id, 
            db_data.image1, db_data.image2, db_data.image3, db_data.image4, db_data.video
        ]);

        res.json({ status: 'success', message: 'Media saved successfully!' });

    } catch (err) {
        // Catches storage errors or database errors
        return sendError(res, err, 'STORAGE_UPLOAD_ERROR');
    }
});
// ---------------- END UPLOAD MEDIA ----------------

// ---------------- CREATE LISTING ----------------
app.get('/create-listing', (req, res) => {
    const listing_id = Date.now().toString() + '_' + Math.round(Math.random() * 10000);

    const sqls = [
        'INSERT INTO step1 (listing_id) VALUES ($1) ON CONFLICT DO NOTHING',
        'INSERT INTO step2 (listing_id) VALUES ($1) ON CONFLICT DO NOTHING',
        'INSERT INTO step3 (listing_id) VALUES ($1) ON CONFLICT DO NOTHING',
        'INSERT INTO upload (listing_id) VALUES ($1) ON CONFLICT DO NOTHING'
    ];

    let i = 0;
    function runNext(err) {
        if (err) return sendError(res, err, 'CREATE_LISTING_ERROR');
        if (i >= sqls.length) {
            return res.json({ status: 'success', listing_id, listingId: listing_id });
        }
        db.query(sqls[i++], [listing_id], runNext);
    }
    runNext();
});

// ---------------- PUBLISH FINAL (STEP 4) ----------------
app.post('/publish-final', (req, res) => {
    const { listing_id } = req.body;
    if (!listing_id) return res.status(400).json({ status: 'error', message: 'listing_id missing' });

    const sql = `
        INSERT INTO step4 (
          listing_id, property_title, description, property_type, bedrooms, bathrooms, total_area,
          amenities, special_notes, price, city, area, image1, image2, image3, image4, video
        )
        SELECT
          s1.listing_id,
          s1.property_title, s1.description, s1.property_type,
          s1.bedrooms, s1.bathrooms, s1.total_area,
          CONCAT_WS(',',
            CASE WHEN s2.wifi=1 THEN 'wifi' ELSE NULL END, CASE WHEN s2.tv=1 THEN 'tv' ELSE NULL END, 
            CASE WHEN s2.ac=1 THEN 'ac' ELSE NULL END, CASE WHEN s2.heating=1 THEN 'heating' ELSE NULL END, 
            CASE WHEN s2.washer=1 THEN 'washer' ELSE NULL END, CASE WHEN s2.dryer=1 THEN 'dryer' ELSE NULL END,
            CASE WHEN s2.refrigerator=1 THEN 'refrigerator' ELSE NULL END, CASE WHEN s2.stove=1 THEN 'stove' ELSE NULL END,
            CASE WHEN s2.microwave=1 THEN 'microwave' ELSE NULL END, CASE WHEN s2.coffee_maker=1 THEN 'coffee_maker' ELSE NULL END,
            CASE WHEN s2.dishwasher=1 THEN 'dishwasher' ELSE NULL END, CASE WHEN s2.smoke_alarm=1 THEN 'smoke_alarm' ELSE NULL END,
            CASE WHEN s2.co_alarm=1 THEN 'co_alarm' ELSE NULL END, CASE WHEN s2.first_aid=1 THEN 'first_aid' ELSE NULL END,
            CASE WHEN s2.fire_extinguisher=1 THEN 'fire_extinguisher' ELSE NULL END
          ),
          s2.special_notes,
          s3.price, s3.city, s3.area,
          u.image1, u.image2, u.image3, u.image4, u.video
        FROM step1 s1
        JOIN step2 s2 ON s1.listing_id = s2.listing_id
        JOIN step3 s3 ON s1.listing_id = s3.listing_id
        JOIN upload u ON s1.listing_id = u.listing_id
        WHERE s1.listing_id = $1
        ON CONFLICT (listing_id) DO UPDATE SET 
          property_title = EXCLUDED.property_title, description = EXCLUDED.description,
          property_type = EXCLUDED.property_type, bedrooms = EXCLUDED.bedrooms,
          bathrooms = EXCLUDED.bathrooms, total_area = EXCLUDED.total_area,
          amenities = EXCLUDED.amenities, special_notes = EXCLUDED.special_notes,
          price = EXCLUDED.price, city = EXCLUDED.city, area = EXCLUDED.area,
          image1 = EXCLUDED.image1, image2 = EXCLUDED.image2, image3 = EXCLUDED.image3, image4 = EXCLUDED.image4,
          video = EXCLUDED.video
    `;

    db.query(sql, [listing_id], (err, result) => {
        if (err) return sendError(res, err, 'PUBLISH_ERROR');
        res.json({ status: 'success', message: 'Listing Published Successfully!' });
    });
});

// ---------------- GET ALL PUBLISHED LISTINGS ----------------
app.get('/get-all-listings', (req, res) => {
    // Postgres: result.rows holds the data
    db.query('SELECT * FROM step4 ORDER BY id DESC', [], (err, result) => {
        if (err) return sendError(res, err, 'GET_ALL_ERROR');
        res.json({ status: 'success', data: result.rows });
    });
});

// ---------------- GET FINAL LISTING (Single) ----------------
app.get('/get-final-listing/:id', (req, res) => {
    const listing_id = req.params.id;
    db.query('SELECT * FROM step4 WHERE listing_id = $1 LIMIT 1', [listing_id], (err, result) => {
        if (err) return sendError(res, err, 'GET_FINAL_ERROR');
        if (!result.rows || result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Listing not found' });
        res.json({ status: 'success', data: result.rows[0] });
    });
});

// ---------------- GET LISTING WITH ALL STEPS ----------------
app.get('/get-listing/:id', (req, res) => {
    const listing_id = req.params.id;
    if (!listing_id) return res.status(400).json({ status: 'error', message: 'listing_id missing' });

    let output = { step1: {}, step2: {}, step3: {}, media: {} };

    // Note: Using result.rows instead of rows
    db.query('SELECT * FROM step1 WHERE listing_id = $1', [listing_id], (e1, r1) => {
        if (!e1 && r1.rows.length > 0) output.step1 = r1.rows[0];

        db.query('SELECT * FROM step2 WHERE listing_id = $1', [listing_id], (e2, r2) => {
            if (!e2 && r2.rows.length > 0) output.step2 = r2.rows[0];

            db.query('SELECT * FROM step3 WHERE listing_id = $1', [listing_id], (e3, r3) => {
                if (!e3 && r3.rows.length > 0) output.step3 = r3.rows[0];

                db.query('SELECT * FROM upload WHERE listing_id = $1', [listing_id], (e4, r4) => {
                    if (!e4 && r4.rows.length > 0) output.media = r4.rows[0];
                    res.json({ status: 'success', data: output });
                });
            });
        });
    });
});

// ---------------- GET MOST RECENT LISTING ----------------
app.get('/get-latest-listing', (req, res) => {
    const query = 'SELECT listing_id FROM step4 ORDER BY created_at DESC LIMIT 1'; // Updated to use step4 and created_at
    db.query(query, [], (err, result) => {
        if (err) return sendError(res, err, 'GET_LATEST_ERROR');
        if (!result.rows || result.rows.length === 0) return res.json({ status: 'error', message: 'No listings found' });

        const listing_id = result.rows[0].listing_id;
        let output = { step1: {}, step2: {}, step3: {}, media: {} };

        db.query('SELECT * FROM step1 WHERE listing_id = $1', [listing_id], (e1, r1) => {
            if (!e1 && r1.rows.length > 0) output.step1 = r1.rows[0];
            db.query('SELECT * FROM step2 WHERE listing_id = $1', [listing_id], (e2, r2) => {
                if (!e2 && r2.rows.length > 0) output.step2 = r2.rows[0];
                db.query('SELECT * FROM step3 WHERE listing_id = $1', [listing_id], (e3, r3) => {
                    if (!e3 && r3.rows.length > 0) output.step3 = r3.rows[0];
                    db.query('SELECT * FROM upload WHERE listing_id = $1', [listing_id], (e4, r4) => {
                        if (!e4 && r4.rows.length > 0) output.media = r4.rows[0];
                        return res.json({ status: 'success', listing_id, data: output });
                    });
                });
            });
        });
    });
});

// ---------------- SEARCH LISTINGS ----------------
app.get('/search', (req, res) => {
    const q = req.query.q || '';
    const like = `%${q}%`;
    // Postgres: LIKE $1
    const sql = `SELECT * FROM step4 WHERE city LIKE $1 OR area LIKE $2 OR price::text LIKE $3 ORDER BY id DESC`;
    db.query(sql, [like, like, like], (err, result) => {
        if (err) return sendError(res, err, 'SEARCH_ERROR');
        res.json({ status: 'success', data: result.rows });
    });
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server running on port', PORT));

app.get("/", (req, res) => {
  res.send("🚀 API is LIVE — Railway backend running successfully");
});
