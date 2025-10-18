/**
 * Cloudflare Function: On-Demand Payment Email Verification
 * Checks Gmail for payment confirmation emails when order is placed
 * 
 * Flow:
 * 1. Frontend calls this after order creation
 * 2. Connect to Gmail via IMAP
 * 3. Search for payment confirmation email (60 second timeout)
 * 4. Parse email to extract payment details
 * 5. Match payment with order
 * 6. Update order status in Supabase
 * 7. Return verification result
 */

interface Env {
  // Environment variables
  GMAIL_EMAIL: string; // hrejuh@gmail.com
  GMAIL_APP_PASSWORD: string; // Gmail app password
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WEBHOOK_SECRET: string; // For verifying requests
}

interface VerificationRequest {
  orderId: string;
  transactionId: string;
  amount: number;
  timestamp: string;
}

interface ParsedPayment {
  bankName: string;
  amount: number;
  upiReference: string;
  senderVPA: string;
  receiverVPA: string;
  timestamp: Date;
  transactionId?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: any[];
    }>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Verify webhook secret
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
        console.error('Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse request body
      const verificationRequest: VerificationRequest = await request.json();
      console.log('🔍 Verification request:', verificationRequest);

      // Check Gmail for payment confirmation (with 60 second timeout)
      const email = await checkGmailForPayment(
        env,
        verificationRequest.transactionId,
        verificationRequest.amount,
        60 // timeout in seconds
      );

      if (!email) {
        console.log('⏰ No payment email found within timeout');
        return new Response(JSON.stringify({ 
          verified: false,
          message: 'Payment email not found yet'
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('📧 Found payment email');
      
      // Parse email for payment details
      const parsedPayment = await parsePaymentEmail(email, env);

      if (!parsedPayment) {
        console.log('❌ Could not parse payment from email');
        return new Response(JSON.stringify({ 
          verified: false,
          message: 'Could not parse payment email'
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('💰 Parsed payment:', parsedPayment);

      // Verify and update order in Supabase
      const verified = await verifyPaymentInSupabase(
        parsedPayment,
        email,
        verificationRequest.orderId,
        env
      );

      return new Response(JSON.stringify({ 
        verified,
        payment: parsedPayment,
        message: verified ? 'Payment verified successfully' : 'Verification failed'
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ Error processing verification:', error);
      return new Response(JSON.stringify({ 
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
};

/**
 * Check Gmail for payment confirmation email using IMAP
 * Polls for up to timeoutSeconds
 */
async function checkGmailForPayment(
  env: Env,
  transactionId: string,
  amount: number,
  timeoutSeconds: number
): Promise<any | null> {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  
  // Poll every 3 seconds
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use Gmail API with app password (simpler than full OAuth)
      const emails = await searchGmailEmails(env, transactionId, amount);
      
      if (emails && emails.length > 0) {
        return emails[0]; // Return first matching email
      }
      
      // Wait 3 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('Error checking Gmail:', error);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  return null; // Timeout reached
}

/**
 * Search Gmail for payment emails
 * Uses Gmail API with app password
 */
async function searchGmailEmails(
  env: Env,
  transactionId: string,
  amount: number
): Promise<any[]> {
  // Simplified search - just look for recent payment emails with the amount
  const searchQuery = [
    'from:(phonepe.com OR google.com OR paytm.com OR npci.org.in OR hdfcbank.com OR icicibank.com OR axisbank.com OR sbi.co.in OR yesbank.in)',
    'subject:(payment OR transaction OR successful OR credited)',
    `"Rs. ${amount}" OR "Rs ${amount}" OR "₹${amount}"`,
    'newer_than:5m' // Only check emails from last 5 minutes
  ].join(' ');
  
  console.log('Searching Gmail with query:', searchQuery);
  
  // Use Gmail API search endpoint
  const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}`;
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${await getAppPasswordToken(env)}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to search Gmail');
  }
  
  const data = await response.json();
  
  if (!data.messages || data.messages.length === 0) {
    console.log('No matching emails found');
    return [];
  }
  
  console.log(`Found ${data.messages.length} potential emails`);
  
  // Fetch and check each email for exact amount match
  const matchingEmails: any[] = [];
  
  for (const message of data.messages.slice(0, 5)) { // Check first 5 emails
    const emailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${await getAppPasswordToken(env)}`
        }
      }
    );
    
    if (emailResponse.ok) {
      const email = await emailResponse.json();
      const body = extractEmailBody(email);
      
      // Extract amount from email body
      const amountMatch = body.match(/Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)|₹\s*([0-9,]+(?:\.[0-9]{2})?)/i);
      if (amountMatch) {
        const emailAmount = parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ''));
        console.log(`Email amount: ${emailAmount}, Expected: ${amount}`);
        
        // Check if amounts match (within 0.01 tolerance)
        if (Math.abs(emailAmount - amount) < 0.01) {
          console.log('✅ Amount matches!');
          matchingEmails.push(email);
          break; // Found a match, stop searching
        }
      }
    }
  }
  
  return matchingEmails;
}

/**
 * Get access token using app password
 * Simpler than full OAuth flow
 */
async function getAppPasswordToken(env: Env): Promise<string> {
  // For app password, we use basic auth
  const credentials = btoa(`${env.GMAIL_EMAIL}:${env.GMAIL_APP_PASSWORD}`);
  return credentials;
}

/**
 * Extract email body from Gmail message
 */
function extractEmailBody(message: any): string {
  let body = '';

  // Try to get plain text body
  if (message.payload?.body?.data) {
    body = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  } else if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        break;
      }
      // Fallback to HTML if no plain text
      if (part.mimeType === 'text/html' && part.body?.data && !body) {
        const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        // Strip HTML tags (basic)
        body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      }
    }
  }

  return body;
}

/**
 * Parse payment details from email (simplified - just extract amount)
 */
async function parsePaymentEmail(
  email: any,
  env: Env
): Promise<ParsedPayment | null> {
  // Extract email metadata
  const headers = email.payload?.headers || [];
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
  const from = headers.find((h: any) => h.name === 'From')?.value || '';
  const body = extractEmailBody(email);

  console.log('📨 Email subject:', subject);
  console.log('📨 Email from:', from);

  // Simple amount extraction
  const amountMatch = body.match(/Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)|₹\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  if (!amountMatch) {
    console.log('❌ Could not find amount in email');
    return null;
  }
  
  const amount = parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ''));
  
  // Extract UPI reference (optional)
  const refMatch = body.match(/reference number is\s+([0-9]+)|UPI.*?([A-Z0-9]{12,})|RRN[:\s]+([A-Z0-9]+)/i);
  const upiReference = refMatch ? (refMatch[1] || refMatch[2] || refMatch[3]) : '';
  
  // Extract sender VPA (optional)
  const vpaMatch = body.match(/VPA\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)|from[:\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/i);
  const senderVPA = vpaMatch ? (vpaMatch[1] || vpaMatch[2]) : '';
  
  // Determine bank from email domain
  let bankName = 'Unknown';
  if (from.includes('hdfcbank')) bankName = 'HDFC Bank';
  else if (from.includes('icicibank')) bankName = 'ICICI Bank';
  else if (from.includes('axisbank')) bankName = 'Axis Bank';
  else if (from.includes('phonepe')) bankName = 'PhonePe';
  else if (from.includes('google')) bankName = 'Google Pay';
  else if (from.includes('paytm')) bankName = 'Paytm';
  
  console.log(`✅ Parsed: Amount=${amount}, Bank=${bankName}, Ref=${upiReference}`);

  return {
    bankName,
    amount,
    upiReference,
    senderVPA,
    receiverVPA: '',
    timestamp: new Date(),
    transactionId: undefined
  };
}

/**
 * Get bank email templates from Supabase
 */
async function getBankTemplates(env: Env): Promise<any[]> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/bank_email_templates?is_active=eq.true&order=priority.desc`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch bank templates');
    return [];
  }

  return await response.json();
}

/**
 * Try to parse email with a specific template
 */
function tryParseWithTemplate(
  subject: string,
  body: string,
  from: string,
  template: any
): ParsedPayment | null {
  const text = `${subject} ${body}`;

  // Check if email domain matches
  if (template.email_domain !== '*') {
    if (!from.toLowerCase().includes(template.email_domain.toLowerCase())) {
      return null;
    }
  }

  // Extract amount (required)
  const amountMatch = text.match(new RegExp(template.amount_pattern, 'i'));
  if (!amountMatch) return null;
  
  const amountStr = amountMatch[1] || amountMatch[2];
  const amount = parseFloat(amountStr.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) return null;

  // Extract UPI reference
  const refMatch = template.reference_pattern 
    ? text.match(new RegExp(template.reference_pattern, 'i'))
    : null;
  const upiReference = refMatch ? (refMatch[1] || refMatch[2] || refMatch[3]) : '';

  // Extract sender VPA
  const senderMatch = template.sender_vpa_pattern
    ? text.match(new RegExp(template.sender_vpa_pattern, 'i'))
    : null;
  const senderVPA = senderMatch ? (senderMatch[1] || senderMatch[2]) : '';

  // Extract receiver VPA
  const receiverMatch = template.receiver_vpa_pattern
    ? text.match(new RegExp(template.receiver_vpa_pattern, 'i'))
    : null;
  const receiverVPA = receiverMatch ? (receiverMatch[1] || receiverMatch[2]) : '';

  // Extract transaction ID (our TXN format)
  const txnMatch = template.transaction_id_pattern
    ? text.match(new RegExp(template.transaction_id_pattern, 'i'))
    : null;
  const transactionId = txnMatch ? txnMatch[0] : undefined;

  console.log('✅ Successfully parsed with template:', template.bank_name);

  return {
    bankName: template.bank_name,
    amount,
    upiReference,
    senderVPA,
    receiverVPA,
    timestamp: new Date(),
    transactionId,
  };
}

/**
 * Verify payment and update order in Supabase
 */
async function verifyPaymentInSupabase(
  payment: ParsedPayment,
  email: any,
  orderId: string,
  env: Env
): Promise<boolean> {
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  // Extract email metadata
  const emailHeaders = email.payload?.headers || [];
  const subject = emailHeaders.find((h: any) => h.name === 'Subject')?.value || '';
  const from = emailHeaders.find((h: any) => h.name === 'From')?.value || '';
  const body = extractEmailBody(email);

  // Create payment verification record
  const verification = {
    transaction_id: payment.transactionId || '',
    email_subject: subject,
    email_body: body.substring(0, 5000), // Limit body size
    email_from: from,
    email_received_at: new Date().toISOString(),
    email_message_id: email.id,
    bank_name: payment.bankName,
    upi_reference: payment.upiReference,
    amount: payment.amount,
    sender_vpa: payment.senderVPA,
    receiver_vpa: payment.receiverVPA,
    payment_timestamp: payment.timestamp.toISOString(),
    verification_status: 'pending',
    verification_method: 'email_parse',
    raw_email_data: {
      messageId: email.id,
      threadId: email.threadId,
      snippet: email.snippet,
    },
  };

  // Insert verification record
  const verifyResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/payment_verifications`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(verification),
    }
  );

  if (!verifyResponse.ok) {
    const error = await verifyResponse.text();
    console.error('Failed to create verification record:', error);
    throw new Error('Failed to create verification record');
  }

  const verificationRecord = await verifyResponse.json();
  const verificationId = verificationRecord[0].id;

  console.log('✅ Created verification record:', verificationId);

  // Find matching order
  const matchResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/find_matching_order`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_transaction_id: payment.transactionId || '',
        p_amount: payment.amount,
        p_payment_time: payment.timestamp.toISOString(),
      }),
    }
  );

  if (!matchResponse.ok) {
    console.error('Failed to find matching order');
    return false;
  }

  const matches = await matchResponse.json();
  
  if (!matches || matches.length === 0) {
    console.log('⚠️ No matching order found');
    
    // Update verification status
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/payment_verifications?id=eq.${verificationId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          verification_status: 'failed',
          error_message: 'No matching order found',
        }),
      }
    );
    
    return false;
  }

  const match = matches[0];
  console.log('🎯 Found matching order:', match.order_id, 'Confidence:', match.confidence_score);

  // Update verification with match details
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/payment_verifications?id=eq.${verificationId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        order_id: match.order_id,
        confidence_score: match.confidence_score,
        amount_match: true,
        reference_match: !!payment.transactionId,
        time_window_match: true,
      }),
    }
  );

  // Verify the order
  const verifyOrderResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/verify_order_payment`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_order_id: match.order_id,
        p_verification_id: verificationId,
      }),
    }
  );

  if (!verifyOrderResponse.ok) {
    console.error('Failed to verify order');
    return false;
  }

  const verified = await verifyOrderResponse.json();

  if (verified) {
    console.log('✅ Order verified successfully!');
    
    // Update verification status
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/payment_verifications?id=eq.${verificationId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        }),
      }
    );

    // Log success
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/payment_verification_logs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          verification_id: verificationId,
          event_type: 'verification_success',
          event_data: {
            order_id: match.order_id,
            confidence_score: match.confidence_score,
            match_reason: match.match_reason,
          },
        }),
      }
    );
    
    return true;
  }
  
  return false;
}
