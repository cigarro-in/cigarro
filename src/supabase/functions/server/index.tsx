import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

// Server-side validation utilities
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;

interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string;
}

const sanitizeString = (input: string, maxLength: number = 255): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

const validateEmail = (email: string): ValidationResult => {
  const sanitized = sanitizeString(email, 254);
  
  if (!sanitized) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (!EMAIL_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return { isValid: true, sanitizedValue: sanitized.toLowerCase() };
};

const validateName = (name: string, fieldName: string = 'Name'): ValidationResult => {
  const sanitized = sanitizeString(name, 100);
  
  if (!sanitized) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters long` };
  }
  
  if (!NAME_REGEX.test(sanitized)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

const validatePrice = (price: string | number): ValidationResult => {
  const priceStr = typeof price === 'number' ? price.toString() : price;
  const sanitized = sanitizeString(priceStr, 20);
  
  if (!sanitized) {
    return { isValid: false, error: 'Price is required' };
  }
  
  if (!PRICE_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Invalid price format' };
  }
  
  const priceNum = parseFloat(sanitized);
  if (priceNum < 0) {
    return { isValid: false, error: 'Price cannot be negative' };
  }
  
  if (priceNum > 999999.99) {
    return { isValid: false, error: 'Price too high' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

const validateApiInput = (input: any, schema: Record<string, (value: any) => ValidationResult>): {
  isValid: boolean;
  errors: string[];
  sanitizedInput: any;
} => {
  const errors: string[] = [];
  const sanitizedInput: any = {};
  
  for (const [field, value] of Object.entries(input)) {
    const validator = schema[field];
    if (validator) {
      const result = validator(value);
      if (!result.isValid) {
        errors.push(result.error || 'Invalid value');
      } else {
        sanitizedInput[field] = result.sanitizedValue || value;
      }
    } else {
      sanitizedInput[field] = value;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedInput
  };
};

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173", 
      "https://yourdomain.com",
      "https://www.yourdomain.com"
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
);

// Health check endpoint
app.get("/make-server-3d61b454/health", (c) => {
  return c.json({ status: "ok" });
});

// Authentication routes
app.post("/make-server-3d61b454/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Sign up error:', error);
      return c.text(error.message, 400);
    }

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata.name
      },
      token: data.session?.access_token || ''
    });
  } catch (error) {
    console.error('Sign up error:', error);
    return c.text('Failed to create account', 500);
  }
});

app.post("/make-server-3d61b454/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return c.text('Invalid credentials', 401);
    }

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata.name
      },
      token: data.session.access_token
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return c.text('Invalid credentials', 401);
  }
});

app.get("/make-server-3d61b454/auth/session", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.text('Unauthorized', 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.text('Unauthorized', 401);
    }

    return c.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata.name
    });
  } catch (error) {
    console.error('Session check error:', error);
    return c.text('Unauthorized', 401);
  }
});

// Cart routes
app.get("/make-server-3d61b454/cart", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.text('Unauthorized', 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.text('Unauthorized', 401);
    }

    const cartData = await kv.get(`cart:${user.id}`);
    return c.json(cartData || { items: [] });
  } catch (error) {
    console.error('Failed to load cart:', error);
    return c.text('Failed to load cart', 500);
  }
});

app.post("/make-server-3d61b454/cart", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.text('Unauthorized', 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return c.text('Unauthorized', 401);
    }

    const { items } = await c.req.json();
    await kv.set(`cart:${user.id}`, { items });
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to save cart:', error);
    return c.text('Failed to save cart', 500);
  }
});


Deno.serve(app.fetch);