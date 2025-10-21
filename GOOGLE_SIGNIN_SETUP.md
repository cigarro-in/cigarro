# Google Sign-In Setup Guide

## ✅ Implementation Complete

Google Sign-In has been successfully integrated into your application. Users can now sign in or sign up using their Google account.

## 📋 What Was Implemented

### 1. **Frontend Changes**

#### `useAuth.tsx` Hook
- Added `signInWithGoogle()` function to AuthContext
- Configured OAuth redirect to home page
- Added proper error handling

#### `AuthDialog.tsx` Component
- Added Google Sign-In button to both Sign In and Sign Up tabs
- Added "Or continue with" divider for better UX
- Used Chrome icon from Lucide React
- Styled to match Cigarro theme (creme, coyote, dark colors)
- Proper loading states during OAuth flow

### 2. **User Flow**
1. User clicks "Sign in with Google" or "Sign up with Google"
2. Redirected to Google OAuth consent screen
3. After approval, redirected back to your app
4. User session automatically created in Supabase
5. Profile automatically created in `profiles` table

---

## 🔧 Supabase Configuration Required

To enable Google Sign-In, you need to configure it in your Supabase project:

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
   Replace `your-project-ref` with your actual Supabase project reference

7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list
5. Toggle **Enable Sign in with Google**
6. Paste your **Client ID** and **Client Secret**
7. Click **Save**

### Step 3: Update Site URL (if needed)

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://yourdomain.com
   ```
3. Add **Redirect URLs** (if using multiple domains):
   ```
   http://localhost:3000
   https://yourdomain.com
   ```

---

## 🧪 Testing

### Local Development
1. Make sure your dev server is running: `npm run dev`
2. Open the auth dialog
3. Click "Sign in with Google"
4. You should be redirected to Google OAuth
5. After approval, you'll be redirected back to `http://localhost:3000/`

### Production
1. Deploy your application
2. Test the same flow on your production domain
3. Verify users are created in Supabase **Authentication** → **Users**

---

## 🔒 Security Notes

### Redirect URL Validation
- Supabase automatically validates redirect URLs
- Only URLs configured in your Supabase settings will work
- This prevents OAuth hijacking attacks

### User Data
- Google provides: email, name, profile picture
- Profile is automatically created in your `profiles` table
- User metadata includes Google profile info

### Session Management
- Sessions are handled by Supabase Auth
- Tokens are stored securely in localStorage
- Automatic token refresh

---

## 🎨 UI Customization

The Google Sign-In button follows your Cigarro theme:
- **Background**: White (`bg-white`)
- **Border**: Coyote color (`border-coyote`)
- **Text**: Dark (`text-dark`)
- **Hover**: Creme light (`hover:bg-creme-light`)
- **Icon**: Chrome icon from Lucide React

To customize, edit the Button component in `AuthDialog.tsx`:
```tsx
<Button
  type="button"
  onClick={handleGoogleSignIn}
  disabled={isLoading}
  variant="outline"
  className="w-full h-10 sm:h-12 lg:h-14 bg-white border-2 border-coyote text-dark font-sans font-medium text-sm sm:text-base lg:text-lg rounded-lg hover:bg-creme-light transition-all duration-300 shadow-sm hover:shadow-md"
>
  <Chrome className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3" />
  {isLoading ? 'Connecting...' : 'Sign in with Google'}
</Button>
```

---

## 🐛 Troubleshooting

### "Invalid redirect URI" Error
- **Cause**: Redirect URI not configured in Google Cloud Console
- **Fix**: Add your Supabase callback URL to authorized redirect URIs

### "Provider not enabled" Error
- **Cause**: Google provider not enabled in Supabase
- **Fix**: Enable Google in Supabase Dashboard → Authentication → Providers

### User Not Redirected Back
- **Cause**: Site URL mismatch
- **Fix**: Verify Site URL in Supabase matches your domain

### Profile Not Created
- **Cause**: Database trigger might be missing
- **Fix**: Check if `handle_new_user()` trigger exists in Supabase

---

## 📊 Database Schema

When a user signs in with Google, the following happens:

1. **User created in `auth.users`** (Supabase Auth table)
   - Contains Google OAuth data
   - Email, name, profile picture

2. **Profile created in `public.profiles`** (via trigger)
   - `id`: User ID (UUID)
   - `email`: User's email
   - `name`: User's name from Google
   - `is_admin`: false (default)

---

## 🚀 Next Steps

### Optional Enhancements

1. **Add More Providers**
   - Facebook, GitHub, Twitter, etc.
   - Same pattern as Google implementation

2. **Profile Picture**
   - Google provides avatar URL
   - Store in `profiles` table
   - Display in user menu

3. **Email Verification**
   - Google emails are pre-verified
   - No need for email confirmation

4. **Account Linking**
   - Allow users to link multiple providers
   - Requires additional logic

---

## 📝 Summary

✅ **Google Sign-In is ready to use!**

Just configure your Google OAuth credentials in Supabase, and users can start signing in with Google immediately.

**Files Modified:**
- `src/hooks/useAuth.tsx` - Added `signInWithGoogle()` function
- `src/components/auth/AuthDialog.tsx` - Added Google Sign-In buttons

**No database migrations needed** - Supabase handles everything automatically!
