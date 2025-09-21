# Pincode Upload Script

Simple script to upload Indian postal codes to Supabase database with proper formatting and deduplication.

## Quick Start

```bash
# 1. Ensure pincodes.csv is in the root directory
# 2. Set up .env file with Supabase credentials
# 3. Run the script

cd scripts
npm run upload
```

## Features

- ✅ **Auto-deduplication** - Removes ~146k duplicates, keeps ~19k unique pincodes
- ✅ **Proper case formatting** - "NEW DELHI" → "New Delhi"
- ✅ **Complete data** - Includes state codes, regions, and shipping configuration
- ✅ **Batch processing** - Handles large datasets efficiently
- ✅ **Auto-cleanup** - Clears existing data before upload

## Requirements

1. **Node.js** (v16+)
2. **pincodes.csv** in root directory
3. **.env file** with Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   ```

## Usage Options

```bash
# Option 1: npm script (recommended)
npm run upload

# Option 2: Direct execution
node upload-pincodes.js

# Option 3: Alternative npm commands
npm start
npm run upload-pincodes
```

## CSV Format Expected

```csv
pin_code,district,province
110001,NEW DELHI,DELHI
400001,MUMBAI,MAHARASHTRA
```

## What It Does

1. **Reads** pincodes.csv from root directory
2. **Deduplicates** entries (keeps first occurrence)
3. **Formats** city/state names to proper case
4. **Clears** existing postal_codes table
5. **Uploads** in 1000-record batches
6. **Verifies** with sample records

## Output Example

```
🚀 Starting Simple Pincode Upload...
📖 Reading pincodes.csv...
✅ Found 19576 unique pincodes
🔄 Skipped 146048 duplicates
🗑️ Clearing existing postal codes...
📤 Uploading 19576 pincodes...
📦 Batch 1/20 (1000 records)...
✅ Batch 1 uploaded
...
🎉 Upload complete! 19576/19576 pincodes uploaded

📋 Sample records:
   110001 - New Delhi, Delhi (DL) [North]
   400001 - Mumbai, Maharashtra (MH) [West]
```

## Database Schema

Populates `postal_codes` table with:
- **Location**: postal_code, city, state, state_code, region
- **Serviceability**: All set to serviceable
- **Shipping**: Standard 7-day, Express 3-day
- **Pricing**: ₹50 base, ₹100 express, ₹500 free threshold

## Troubleshooting

- **Missing .env**: Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
- **CSV not found**: Place pincodes.csv in root directory (not scripts folder)
- **Dependencies**: Script auto-installs @supabase/supabase-js if missing
