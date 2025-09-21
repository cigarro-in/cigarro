#!/usr/bin/env node

/**
 * Simple Pincode Upload Script
 * Reads environment variables from .env file and uploads pincodes
 */

const fs = require('fs');
const path = require('path');

// Simple .env file reader
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found in root directory');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return env;
}

// Load environment variables
const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Dynamic import for Supabase (handles both CommonJS and ESM)
async function createSupabaseClient() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  } catch (error) {
    console.error('❌ Failed to load Supabase client. Installing dependencies...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install @supabase/supabase-js', { stdio: 'inherit' });
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    } catch (installError) {
      console.error('❌ Failed to install @supabase/supabase-js');
      process.exit(1);
    }
  }
}

// Convert text to proper case (Title Case)
function toProperCase(text) {
  if (!text) return text;
  
  return text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

// Parse CSV and get unique pincodes
function parseCSV() {
  const csvPath = path.join(__dirname, '..', 'pincodes.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ pincodes.csv not found in root directory');
    process.exit(1);
  }
  
  console.log('📖 Reading pincodes.csv...');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.trim().split('\n').slice(1); // Skip header
  
  const uniquePincodes = new Map();
  let duplicates = 0;
  
  for (const line of lines) {
    const [pinCode, district, state] = line.split(',').map(s => s.trim().replace(/"/g, ''));
    
    if (!/^\d{6}$/.test(pinCode)) continue;
    
    if (!uniquePincodes.has(pinCode)) {
      // Convert to proper case for better display
      const properDistrict = toProperCase(district);
      const properState = toProperCase(state);
      
      uniquePincodes.set(pinCode, {
        postal_code: pinCode,
        area: null,
        city: properDistrict || 'Unknown',
        district: properDistrict,
        state: properState || 'Unknown',
        state_code: getStateCode(state),
        region: getRegionFromState(state),
        country: 'India',
        latitude: null,
        longitude: null,
        is_serviceable: true,
        zone_type: 'tier2',
        standard_delivery_days: 7,
        express_delivery_days: 3,
        same_day_available: false,
        overnight_available: false,
        cod_available: true,
        return_pickup_available: true,
        installation_available: false,
        base_shipping_cost: 50.00,
        express_shipping_cost: 100.00,
        free_shipping_threshold: 500.00,
        delivery_hub: null,
        sort_code: null,
        restrictions: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString()
      });
    } else {
      duplicates++;
    }
  }
  
  console.log(`✅ Found ${uniquePincodes.size} unique pincodes`);
  console.log(`🔄 Skipped ${duplicates} duplicates`);
  
  return Array.from(uniquePincodes.values());
}

// Get state code from state name
function getStateCode(stateName) {
  const stateCodes = {
    'ANDHRA PRADESH': 'AP',
    'ARUNACHAL PRADESH': 'AR',
    'ASSAM': 'AS',
    'BIHAR': 'BR',
    'CHHATTISGARH': 'CG',
    'DELHI': 'DL',
    'GOA': 'GA',
    'GUJARAT': 'GJ',
    'HARYANA': 'HR',
    'HIMACHAL PRADESH': 'HP',
    'JHARKHAND': 'JH',
    'KARNATAKA': 'KA',
    'KERALA': 'KL',
    'MADHYA PRADESH': 'MP',
    'MAHARASHTRA': 'MH',
    'MANIPUR': 'MN',
    'MEGHALAYA': 'ML',
    'MIZORAM': 'MZ',
    'NAGALAND': 'NL',
    'ODISHA': 'OR',
    'PUNJAB': 'PB',
    'RAJASTHAN': 'RJ',
    'SIKKIM': 'SK',
    'TAMIL NADU': 'TN',
    'TELANGANA': 'TG',
    'TRIPURA': 'TR',
    'UTTAR PRADESH': 'UP',
    'UTTARAKHAND': 'UK',
    'WEST BENGAL': 'WB',
    'ANDAMAN AND NICOBAR ISLANDS': 'AN',
    'CHANDIGARH': 'CH',
    'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'DN',
    'JAMMU AND KASHMIR': 'JK',
    'LADAKH': 'LA',
    'LAKSHADWEEP': 'LD',
    'PUDUCHERRY': 'PY'
  };
  
  return stateCodes[stateName?.toUpperCase()] || null;
}

// Get region from state name
function getRegionFromState(stateName) {
  const stateRegions = {
    // North
    'DELHI': 'North',
    'HARYANA': 'North',
    'HIMACHAL PRADESH': 'North',
    'JAMMU AND KASHMIR': 'North',
    'LADAKH': 'North',
    'PUNJAB': 'North',
    'RAJASTHAN': 'North',
    'UTTAR PRADESH': 'North',
    'UTTARAKHAND': 'North',
    'CHANDIGARH': 'North',
    
    // South
    'ANDHRA PRADESH': 'South',
    'KARNATAKA': 'South',
    'KERALA': 'South',
    'TAMIL NADU': 'South',
    'TELANGANA': 'South',
    'PUDUCHERRY': 'South',
    'LAKSHADWEEP': 'South',
    'ANDAMAN AND NICOBAR ISLANDS': 'South',
    
    // East
    'BIHAR': 'East',
    'JHARKHAND': 'East',
    'ODISHA': 'East',
    'WEST BENGAL': 'East',
    
    // West
    'GOA': 'West',
    'GUJARAT': 'West',
    'MAHARASHTRA': 'West',
    'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'West',
    
    // Central
    'CHHATTISGARH': 'Central',
    'MADHYA PRADESH': 'Central',
    
    // Northeast
    'ARUNACHAL PRADESH': 'Northeast',
    'ASSAM': 'Northeast',
    'MANIPUR': 'Northeast',
    'MEGHALAYA': 'Northeast',
    'MIZORAM': 'Northeast',
    'NAGALAND': 'Northeast',
    'SIKKIM': 'Northeast',
    'TRIPURA': 'Northeast'
  };
  
  return stateRegions[stateName?.toUpperCase()] || 'Central';
}

// Upload pincodes
async function uploadPincodes(supabase, pincodes) {
  console.log('🗑️ Clearing existing postal codes...');
  
  // Clear existing data
  const { error: deleteError } = await supabase
    .from('postal_codes')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (deleteError) {
    console.error('❌ Error clearing data:', deleteError.message);
    return;
  }
  
  console.log('✅ Existing data cleared');
  console.log(`📤 Uploading ${pincodes.length} pincodes...`);
  
  // Upload in batches
  const batchSize = 1000;
  let uploaded = 0;
  
  for (let i = 0; i < pincodes.length; i += batchSize) {
    const batch = pincodes.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pincodes.length / batchSize);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
    
    const { error } = await supabase
      .from('postal_codes')
      .insert(batch);
    
    if (error) {
      console.error(`❌ Batch ${batchNum} failed:`, error.message);
    } else {
      uploaded += batch.length;
      console.log(`✅ Batch ${batchNum} uploaded`);
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n🎉 Upload complete! ${uploaded}/${pincodes.length} pincodes uploaded`);
  
  // Quick verification
  const { count } = await supabase
    .from('postal_codes')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Database now contains ${count} postal codes`);
  
  // Show a few sample records to verify proper case formatting
  const { data: samples } = await supabase
    .from('postal_codes')
    .select('postal_code, city, state, state_code, region')
    .limit(3);
  
  if (samples && samples.length > 0) {
    console.log('\n📋 Sample records:');
    samples.forEach(sample => {
      console.log(`   ${sample.postal_code} - ${sample.city}, ${sample.state} (${sample.state_code}) [${sample.region}]`);
    });
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Simple Pincode Upload...\n');
  
  try {
    const supabase = await createSupabaseClient();
    const pincodes = parseCSV();
    await uploadPincodes(supabase, pincodes);
    console.log('\n✅ All done!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
