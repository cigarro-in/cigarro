/**
 * Gmail OAuth2 Refresh Token Generator
 * 
 * Run this script ONCE to get a refresh token for Gmail API access.
 * The refresh token will be used by the Cloudflare function.
 * 
 * Prerequisites:
 * 1. Google Cloud Project with Gmail API enabled
 * 2. OAuth2 Client ID (Desktop app type)
 * 3. Downloaded credentials.json file
 * 
 * Usage:
 *   node scripts/get-gmail-refresh-token.js
 */

const http = require('http');
const url = require('url');
const { exec } = require('child_process');

// Configuration - You'll need to fill these from Google Cloud Console
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

console.log('🔐 Gmail OAuth2 Refresh Token Generator\n');

if (CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
  console.error('❌ ERROR: Please update CLIENT_ID and CLIENT_SECRET in this script first!');
  console.log('\n📝 Steps to get credentials:');
  console.log('1. Go to https://console.cloud.google.com');
  console.log('2. Create/Select a project');
  console.log('3. Enable Gmail API');
  console.log('4. Create OAuth2 Client ID (Desktop app)');
  console.log('5. Download credentials and copy CLIENT_ID and CLIENT_SECRET here\n');
  process.exit(1);
}

// Step 1: Generate authorization URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.append('client_id', CLIENT_ID);
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('scope', SCOPES.join(' '));
authUrl.searchParams.append('access_type', 'offline'); // Important: gets refresh token
authUrl.searchParams.append('prompt', 'consent'); // Force consent to get refresh token

console.log('📖 Step 1: Opening browser for authorization...\n');
console.log('If browser doesn\'t open, visit this URL manually:');
console.log(authUrl.toString());
console.log('\n');

// Open browser
const platform = process.platform;
const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
exec(`${command} "${authUrl.toString()}"`);

// Step 2: Start local server to receive callback
const server = http.createServer(async (req, res) => {
  const queryObject = url.parse(req.url, true).query;
  
  if (queryObject.code) {
    const code = queryObject.code;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1 style="color: green;">✅ Authorization Successful!</h1>
          <p>You can close this window and return to the terminal.</p>
        </body>
      </html>
    `);
    
    // Exchange code for tokens
    console.log('✅ Authorization code received!');
    console.log('🔄 Exchanging code for refresh token...\n');
    
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });
      
      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error('❌ Error getting tokens:', tokens.error_description);
        process.exit(1);
      }
      
      console.log('🎉 SUCCESS! Here are your tokens:\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Add these to your Cloudflare Pages environment variables:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(`GMAIL_USER_EMAIL=hrejuh@gmail.com`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('⚠️  IMPORTANT: Keep these credentials secure!');
      console.log('⚠️  The refresh token allows access to your Gmail.\n');
      
      server.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      server.close();
      process.exit(1);
    }
  } else if (queryObject.error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
          <h1 style="color: red;">❌ Authorization Failed</h1>
          <p>${queryObject.error}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
    console.error('❌ Authorization failed:', queryObject.error);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, () => {
  console.log('🌐 Local server started on http://localhost:3000');
  console.log('⏳ Waiting for authorization...\n');
});

// Timeout after 5 minutes
setTimeout(() => {
  console.log('\n⏰ Timeout: No authorization received after 5 minutes.');
  server.close();
  process.exit(1);
}, 5 * 60 * 1000);
