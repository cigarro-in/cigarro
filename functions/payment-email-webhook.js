/**
 * Cloudflare Function: On-Demand Payment Email Verification with Gmail OAuth2
 * Checks Gmail for payment confirmation emails when order is placed.
 * 
 * Flow:
 * 1. Frontend calls this after order creation
 * 2. Get Gmail access token using OAuth2 refresh token
 * 3. Search Gmail API for payment confirmation email (60 second timeout)
 * 4. Parse email to extract payment details
 * 5. Match payment with order
 * 6. Update order status in Supabase
 * 7. Log all steps to payment_verification_logs
 * 8. Return verification result
 */

// CORS headers for all responses

const ALLOWED_ORIGINS = [
  'https://cigarro.in',
  'https://www.cigarro.in',
  'http://localhost:3000', // Development only
];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

// In-memory cache for access token (lasts 1 hour)
// NOTE: This persists across requests in the same worker instance
let cachedAccessToken = null;
let tokenExpiresAt = 0;

// Cloudflare Pages Function - handle all methods
export async function onRequest(context) {
  const { request, env } = context;
  
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }
  
  console.log('📨 Payment verification webhook called');
  console.log('🌐 Request URL:', request.url);
  console.log('🔐 Auth header present:', !!request.headers.get('Authorization'));
  
  try {
      // Verify webhook secret - REQUIRED environment variable
      const authHeader = request.headers.get('Authorization');
      const expectedSecret = env.WEBHOOK_SECRET;
      
      if (!expectedSecret) {
        console.error('❌ WEBHOOK_SECRET environment variable not set');
        return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
          status: 500,
          headers: corsHeaders
        });
      }
      
      if (authHeader !== `Bearer ${expectedSecret}`) {
        console.error('❌ Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: corsHeaders
        });
      }

      console.log('✅ Webhook secret verified');

      // Parse request body
      const verificationRequest = await request.json();
      
      // Validate required fields
      if (!verificationRequest.orderId || !verificationRequest.transactionId || !verificationRequest.amount) {
        console.error('❌ Missing required fields');
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: orderId, transactionId, amount' 
        }), { 
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Get order creation timestamp (critical for correct email search window)
      const orderCreatedAt = verificationRequest.orderCreatedAt || verificationRequest.timestamp || new Date().toISOString();
      console.log('📅 Order created at:', orderCreatedAt);
      
      // Validate amount is a positive number
      const amount = parseFloat(verificationRequest.amount);
      if (isNaN(amount) || amount <= 0) {
        console.error('❌ Invalid amount:', verificationRequest.amount);
        return new Response(JSON.stringify({ 
          error: 'Invalid amount' 
        }), { 
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Sanitized logging - don't log full request in production
      console.log('🔍 Verification request received:', {
        transactionId: verificationRequest.transactionId,
        amount: amount,
        hasOrderId: !!verificationRequest.orderId
      });

      // Create initial log entry
      const logId = await createVerificationLog(env, {
        orderId: verificationRequest.orderId,
        transactionId: verificationRequest.transactionId,
        amount: amount,
        status: 'pending'
      });

      // Check Gmail for payment confirmation (with 5 minute timeout)
      // NOTE: Cloudflare only shows logs AFTER function completes
      const email = await checkGmailForPayment(
        env,
        verificationRequest.transactionId,
        verificationRequest.amount,
        300, // timeout in seconds - 5 minutes to allow for payment processing
        orderCreatedAt // Pass order creation time as baseline
      );

      if (!email) {
        console.log('⏰ No payment email found within timeout');
        
        // Update log - email not found
        await updateVerificationLog(env, logId, {
          status: 'failed',
          email_found: false,
          error_message: 'No payment email found within 5 minutes'
        });
        
        return new Response(JSON.stringify({ 
          verified: false,
          message: 'Payment email not found yet'
        }), { 
          status: 200,
          headers: corsHeaders
        });
      }

      console.log('📧 Found payment email');
      
      // Update log - email found
      await updateVerificationLog(env, logId, {
        email_found: true
      });
      
      // Parse email for payment details
      const parsedPayment = await parsePaymentEmail(email, env);

      if (!parsedPayment) {
        console.log('❌ Could not parse payment from email');
        
        // Update log - parsing failed
        await updateVerificationLog(env, logId, {
          status: 'failed',
          email_parsed: false,
          error_message: 'Could not parse payment details from email'
        });
        
        return new Response(JSON.stringify({ 
          verified: false,
          message: 'Could not parse payment email'
        }), { 
          status: 200,
          headers: corsHeaders
        });
      }

      console.log('💰 Parsed payment:', parsedPayment);
      
      // Update log - email parsed successfully
      await updateVerificationLog(env, logId, {
        email_parsed: true,
        bank_name: parsedPayment.bankName,
        upi_reference: parsedPayment.upiReference,
        sender_vpa: parsedPayment.senderVPA
      });

      // Check if amount matches
      const amountMatches = Math.abs(parsedPayment.amount - verificationRequest.amount) < 0.01;

      if (!amountMatches) {
        console.log(`Amount mismatch: ${parsedPayment.amount} vs ${verificationRequest.amount}`);
        
        // Update log - amount mismatch
        await updateVerificationLog(env, logId, {
          status: 'failed',
          amount_matched: false,
          error_message: `Amount mismatch: expected ${verificationRequest.amount}, got ${parsedPayment.amount}`
        });
        
        return new Response(JSON.stringify({ 
          verified: false,
          message: 'Payment amount does not match'
        }), { 
          status: 200,
          headers: corsHeaders
        });
      }

      console.log('✅ Amount matches!');
      
      // Update log - amount matched
      await updateVerificationLog(env, logId, {
        amount_matched: true
      });

      // Update order status in Supabase
      const orderUpdated = await updateOrderStatus(
        env,
        verificationRequest.orderId,
        'verified',
        parsedPayment
      );

      if (orderUpdated) {
        console.log('✅ Order verified successfully!');
        
        // Update log - verification complete with all payment details
        await updateVerificationLog(env, logId, {
          status: 'verified',
          verified_at: new Date().toISOString(),
          bank_name: parsedPayment.bankName,
          upi_reference: parsedPayment.upiReference,
          sender_vpa: parsedPayment.senderVPA,
          amount: parsedPayment.amount
        });
        
        return new Response(JSON.stringify({ 
          verified: true,
          message: 'Payment verified successfully',
          payment: parsedPayment
        }), { 
          status: 200,
          headers: corsHeaders
        });
      } else {
        console.log('❌ Failed to update order status');
        
        // Update log - database update failed
        await updateVerificationLog(env, logId, {
          status: 'failed',
          error_message: 'Failed to update order status in database'
        });
        
        return new Response(JSON.stringify({ 
          verified: false,
          message: 'Failed to update order status'
        }), { 
          status: 200,
          headers: corsHeaders
        });
      }

    } catch (error) {
      console.error('Error in payment verification:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }), { 
        status: 500,
        headers: corsHeaders
      });
    }
}

/**
 * Check Gmail for payment confirmation email
 * Polls for up to timeoutSeconds, checking emails received AFTER orderCreatedAt
 * @param {string} orderCreatedAt - ISO timestamp when order was created (baseline for email search)
 */
async function checkGmailForPayment(env, transactionId, amount, timeoutSeconds, orderCreatedAt) {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  
  // Convert order creation time to Unix timestamp for Gmail search
  const orderCreatedTimestamp = Math.floor(new Date(orderCreatedAt).getTime() / 1000);
  console.log('📊 Searching for emails received after order creation...');
  console.log(`📅 Order created at: ${orderCreatedAt} (Unix: ${orderCreatedTimestamp})`);
  
  let pollCount = 0;
  
  // Poll every 5 seconds (reduced polling rate)
  while (Date.now() - startTime < timeoutMs) {
    pollCount++;
    console.log(`\n🔄 Poll #${pollCount} (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);
    
    try {
      // Check for emails received AFTER order creation
      const matchingEmails = await searchGmailEmailsAfterTimestamp(env, amount, orderCreatedTimestamp);
      
      if (matchingEmails && matchingEmails.length > 0) {
        console.log(`✅ Found ${matchingEmails.length} email(s) with matching amount after order creation!`);
        return matchingEmails[0]; // Return first matching email
      }
      
      console.log('⏳ No matching payment emails yet, waiting 5 seconds...');
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('❌ Error checking Gmail:', error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log(`⏰ Timeout reached after ${pollCount} polls`);
  return null; // Timeout reached
}

/**
 * Search for Gmail emails received AFTER a specific Unix timestamp
 * This ensures we catch payment emails that arrived between order creation and verification
 */
async function searchGmailEmailsAfterTimestamp(env, amount, afterTimestamp) {
  // Gmail search query: emails received after the order creation time
  // Using 'after:' with Unix timestamp ensures we get emails from the right time window
  const searchQuery = `in:anywhere after:${afterTimestamp}`;
  const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(searchQuery)}`;
  
  console.log(`   🔍 Searching: ${searchQuery}`);
  
  const accessToken = await getGmailAccessToken(env);
  const response = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    throw new Error('Failed to search Gmail');
  }
  
  const data = await response.json();
  
  if (!data.messages || data.messages.length === 0) {
    console.log('   📭 No emails found after order creation time');
    return [];
  }
  
  console.log(`   📬 Found ${data.messages.length} email(s) after order creation`);
  
  const matchingEmails = [];
  
  // Check each email for matching amount
  for (let i = 0; i < data.messages.length; i++) {
    const message = data.messages[i];
    const accessToken = await getGmailAccessToken(env);
    
    const emailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (emailResponse.ok) {
      const email = await emailResponse.json();
      
      // Extract sender and subject for logging
      const fromHeader = email.payload?.headers?.find(h => h.name.toLowerCase() === 'from');
      const subjectHeader = email.payload?.headers?.find(h => h.name.toLowerCase() === 'subject');
      const dateHeader = email.payload?.headers?.find(h => h.name.toLowerCase() === 'date');
      const sender = fromHeader?.value || 'Unknown';
      const subject = subjectHeader?.value || 'No Subject';
      const emailDate = dateHeader?.value || 'Unknown';
      
      console.log(`   📧 Email #${i + 1}:`);
      console.log(`      From: ${sender}`);
      console.log(`      Subject: ${subject}`);
      console.log(`      Date: ${emailDate}`);
      
      const body = extractEmailBody(email);
      
      if (!body || body.length < 10) {
        console.log(`      ⚠️ Could not extract email body`);
        continue;
      }
      
      console.log(`      Body: ${body.substring(0, 150)}...`);
      
      // Extract amount from email body - try multiple patterns
      const amountPatterns = [
        /Rs\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
        /₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
        /INR\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi
      ];
      
      let foundMatch = false;
      for (const pattern of amountPatterns) {
        const matches = [...body.matchAll(pattern)];
        if (matches.length > 0) {
          console.log(`      💰 Found ${matches.length} amount(s):`);
          for (const match of matches) {
            const amountStr = match[1].replace(/,/g, '');
            const emailAmount = parseFloat(amountStr);
            
            if (isNaN(emailAmount)) continue;
            
            console.log(`         - ₹${emailAmount}`);
            
            // Check if amounts match (within 0.01 tolerance)
            if (Math.abs(emailAmount - amount) < 0.01) {
              console.log(`      ✅ MATCH! ₹${emailAmount} = ₹${amount}`);
              matchingEmails.push(email);
              foundMatch = true;
              break;
            }
          }
          if (foundMatch) break;
        }
      }
      
      if (!foundMatch) {
        console.log(`      ❌ No match (expected: ₹${amount})`);
      }
    }
  }
  
  return matchingEmails;
}

// DEPRECATED: Old baseline-based search - replaced with timestamp-based search
// Keeping for reference but no longer used

/**
 * Get Gmail access token using OAuth2 refresh token
 * Caches token for 1 hour to avoid unnecessary refreshes
 */
async function getGmailAccessToken(env) {
  // Check if cached token is still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    console.log('✅ Using cached access token');
    return cachedAccessToken;
  }
  
  console.log('🔄 Refreshing access token...');
  
  // Exchange refresh token for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }
  
  const tokens = await tokenResponse.json();
  
  if (!tokens.access_token) {
    throw new Error('No access token in response');
  }
  
  // Cache the token (expires in 1 hour, we cache for 55 minutes to be safe)
  cachedAccessToken = tokens.access_token;
  tokenExpiresAt = Date.now() + (55 * 60 * 1000);
  
  console.log('✅ Access token refreshed successfully');
  return tokens.access_token;
}

/**
 * Extract email body from Gmail message
 * Enhanced to handle more email formats including HTML-only emails
 */
function extractEmailBody(message) {
  let body = '';

  function decodeBase64(data) {
    try {
      // Gmail uses URL-safe base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return atob(base64);
    } catch (e) {
      console.log('⚠️ Base64 decode error:', e.message);
      return '';
    }
  }

  function extractFromPart(part) {
    if (part.body?.data) {
      const decoded = decodeBase64(part.body.data);
      if (decoded) return decoded;
    }
    
    // Recursively check nested parts
    if (part.parts) {
      for (const nestedPart of part.parts) {
        const extracted = extractFromPart(nestedPart);
        if (extracted) return extracted;
      }
    }
    
    return '';
  }

  // Try direct body first
  if (message.payload?.body?.data) {
    body = decodeBase64(message.payload.body.data);
  }
  
  // Try parts (multipart emails)
  if (!body && message.payload?.parts) {
    // First try to find text/plain
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain') {
        body = extractFromPart(part);
        if (body) break;
      }
    }
    
    // If no text/plain, try text/html and strip tags
    if (!body) {
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/html') {
          const html = extractFromPart(part);
          if (html) {
            // Simple HTML tag stripping
            body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            break;
          }
        }
      }
    }
    
    // Last resort: try any part with data
    if (!body) {
      for (const part of message.payload.parts) {
        body = extractFromPart(part);
        if (body) break;
      }
    }
  }

  return body.trim();
}

/**
 * Parse payment email to extract details
 */
async function parsePaymentEmail(email, env) {
  const body = extractEmailBody(email);
  const subject = email.payload?.headers?.find(h => h.name.toLowerCase() === 'subject')?.value || '';
  const from = email.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value || '';
  
  console.log('Parsing email from:', from);
  
  // Extract amount
  const amountMatch = body.match(/Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)|₹\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (!amountMatch) {
    console.log('Could not extract amount');
    return null;
  }
  
  const amount = parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ''));
  
  // Extract UPI reference
  const upiRefMatch = body.match(/UPI Ref[^:]*:\s*([A-Z0-9]+)/i) || 
                      body.match(/Reference[^:]*:\s*([A-Z0-9]+)/i) ||
                      body.match(/Transaction ID[^:]*:\s*([A-Z0-9]+)/i);
  const upiReference = upiRefMatch ? upiRefMatch[1] : 'N/A';
  
  // Determine bank from sender
  let bankName = 'Unknown';
  if (from.includes('hdfcbank')) bankName = 'HDFC Bank';
  else if (from.includes('phonepe')) bankName = 'PhonePe';
  else if (from.includes('paytm')) bankName = 'Paytm';
  else if (from.includes('icicibank')) bankName = 'ICICI Bank';
  else if (from.includes('axisbank')) bankName = 'Axis Bank';
  else if (from.includes('sbi')) bankName = 'SBI';
  else if (from.includes('yesbank')) bankName = 'Yes Bank';
  else if (from.includes('google')) bankName = 'Google Pay';
  
  return {
    bankName,
    amount,
    upiReference,
    senderVPA: 'N/A',
    receiverVPA: 'N/A',
    timestamp: new Date()
  };
}

/**
 * Update order status in Supabase using new unified transactions system
 */
async function updateOrderStatus(env, orderId, status, paymentDetails) {
  console.log(`🔄 Verifying payment for transaction ${orderId}`);
  
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  // Call the new verify_order_payment RPC function
  const rpcPayload = {
    p_transaction_id: orderId, // This is the internal_transaction_id (TXN12345678)
    p_amount: paymentDetails.amount,
    p_bank_name: paymentDetails.bankName || null,
    p_upi_reference: paymentDetails.upiReference || null,
    p_verification_method: 'email_parse',
    p_email_verification_id: null // Can link to payment_verification_logs if needed
  };
  
  console.log('📝 RPC payload:', JSON.stringify(rpcPayload));

  // Call the secure database function
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/verify_order_payment`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ RPC call failed (${response.status}):`, errorText);
    return false;
  }
  
  const result = await response.json();
  console.log('✅ RPC response:', JSON.stringify(result));
  
  // Check if verification was successful
  if (result.success) {
    console.log(`✅ Payment verified successfully for order ${result.order_id}`);
    return true;
  } else {
    console.error(`❌ Payment verification failed: ${result.message || result.error}`);
    return false;
  }
}

/**
 * Create verification log entry
 */
async function createVerificationLog(env, logData) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/payment_verification_logs`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order_id: logData.orderId,
        transaction_id: logData.transactionId,
        amount: logData.amount,
        status: logData.status,
        email_found: false,
        email_parsed: false,
        amount_matched: false
      }),
    }
  );

  if (response.ok) {
    const data = await response.json();
    return data[0]?.id;
  }
  
  return null;
}

/**
 * Update verification log entry
 */
async function updateVerificationLog(env, logId, updates) {
  if (!logId) return;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/payment_verification_logs?id=eq.${logId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    }
  );
}
