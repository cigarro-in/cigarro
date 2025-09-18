/**
 * Comprehensive Input Validation and Sanitization Utilities
 * Provides both client-side and server-side validation functions
 */

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone number validation regex (international)
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

// Indian PIN code validation
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

// Name validation (letters, spaces, hyphens, apostrophes)
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;

// Slug validation (lowercase, hyphens, numbers)
const SLUG_REGEX = /^[a-z0-9\-]+$/;

// Price validation (positive numbers with up to 2 decimal places)
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;

// URL validation
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string;
}

/**
 * Sanitize string input by trimming and removing dangerous characters
 */
export const sanitizeString = (input: string, maxLength: number = 255): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

/**
 * Validate and sanitize email address
 */
export const validateEmail = (email: string): ValidationResult => {
  const sanitized = sanitizeString(email, 254);
  
  if (!sanitized) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (!EMAIL_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true, sanitizedValue: sanitized.toLowerCase() };
};

/**
 * Validate and sanitize phone number
 */
export const validatePhone = (phone: string, countryCode: string = '+91'): ValidationResult => {
  const sanitized = sanitizeString(phone, 20);
  
  if (!sanitized) {
    return { isValid: false, error: 'Phone number is required' };
  }
  
  // Remove all non-digit characters for validation
  const digits = sanitized.replace(/\D/g, '');
  
  // Country-specific validation
  switch (countryCode) {
    case '+91': // India
      if (!/^\d{10}$/.test(digits)) {
        return { isValid: false, error: 'Please enter a valid 10-digit Indian phone number' };
      }
      break;
    case '+1': // US/Canada
      if (!/^\d{10}$/.test(digits)) {
        return { isValid: false, error: 'Please enter a valid 10-digit phone number' };
      }
      break;
    case '+44': // UK
      if (!/^\d{10,11}$/.test(digits)) {
        return { isValid: false, error: 'Please enter a valid UK phone number' };
      }
      break;
    default:
      if (!/^\d{7,15}$/.test(digits)) {
        return { isValid: false, error: 'Please enter a valid phone number' };
      }
  }
  
  return { isValid: true, sanitizedValue: `${countryCode} ${digits}` };
};

/**
 * Validate and sanitize name
 */
export const validateName = (name: string, fieldName: string = 'Name'): ValidationResult => {
  const sanitized = sanitizeString(name, 100);
  
  if (!sanitized) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters long` };
  }
  
  if (!NAME_REGEX.test(sanitized)) {
    return { isValid: false, error: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize PIN code (Indian)
 */
export const validatePincode = (pincode: string): ValidationResult => {
  const sanitized = sanitizeString(pincode, 10);
  
  if (!sanitized) {
    return { isValid: false, error: 'PIN code is required' };
  }
  
  if (!PINCODE_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Please enter a valid 6-digit PIN code' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize address
 */
export const validateAddress = (address: string): ValidationResult => {
  const sanitized = sanitizeString(address, 500);
  
  if (!sanitized) {
    return { isValid: false, error: 'Address is required' };
  }
  
  if (sanitized.length < 10) {
    return { isValid: false, error: 'Address must be at least 10 characters long' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize password
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be less than 128 characters' };
  }
  
  // Check for common weak passwords
  const weakPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { isValid: false, error: 'Password is too common. Please choose a stronger password' };
  }
  
  return { isValid: true, sanitizedValue: password };
};

/**
 * Validate and sanitize price
 */
export const validatePrice = (price: string | number): ValidationResult => {
  const priceStr = typeof price === 'number' ? price.toString() : price;
  const sanitized = sanitizeString(priceStr, 20);
  
  if (!sanitized) {
    return { isValid: false, error: 'Price is required' };
  }
  
  if (!PRICE_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Please enter a valid price' };
  }
  
  const priceNum = parseFloat(sanitized);
  if (priceNum < 0) {
    return { isValid: false, error: 'Price cannot be negative' };
  }
  
  if (priceNum > 999999.99) {
    return { isValid: false, error: 'Price cannot exceed 999,999.99' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize slug
 */
export const validateSlug = (slug: string): ValidationResult => {
  const sanitized = sanitizeString(slug, 100);
  
  if (!sanitized) {
    return { isValid: false, error: 'Slug is required' };
  }
  
  if (!SLUG_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: 'Slug must be at least 2 characters long' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize URL
 */
export const validateUrl = (url: string, fieldName: string = 'URL'): ValidationResult => {
  const sanitized = sanitizeString(url, 500);
  
  if (!sanitized) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (!URL_REGEX.test(sanitized)) {
    return { isValid: false, error: `Please enter a valid ${fieldName.toLowerCase()}` };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize text content (for descriptions, etc.)
 */
export const validateTextContent = (content: string, fieldName: string = 'Content', maxLength: number = 2000): ValidationResult => {
  const sanitized = sanitizeString(content, maxLength);
  
  if (!sanitized) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  
  if (sanitized.length < 10) {
    return { isValid: false, error: `${fieldName} must be at least 10 characters long` };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate and sanitize quantity
 */
export const validateQuantity = (quantity: string | number): ValidationResult => {
  const quantityStr = typeof quantity === 'number' ? quantity.toString() : quantity;
  const sanitized = sanitizeString(quantityStr, 10);
  
  if (!sanitized) {
    return { isValid: false, error: 'Quantity is required' };
  }
  
  const quantityNum = parseInt(sanitized, 10);
  
  if (isNaN(quantityNum)) {
    return { isValid: false, error: 'Please enter a valid quantity' };
  }
  
  if (quantityNum < 1) {
    return { isValid: false, error: 'Quantity must be at least 1' };
  }
  
  if (quantityNum > 999) {
    return { isValid: false, error: 'Quantity cannot exceed 999' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
};

/**
 * Validate form data object
 */
export const validateFormData = (data: Record<string, any>, rules: Record<string, (value: any) => ValidationResult>): {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedData: Record<string, any>;
} => {
  const errors: Record<string, string> = {};
  const sanitizedData: Record<string, any> = {};
  
  for (const [field, value] of Object.entries(data)) {
    const validator = rules[field];
    if (validator) {
      const result = validator(value);
      if (!result.isValid) {
        errors[field] = result.error || 'Invalid value';
      } else {
        sanitizedData[field] = result.sanitizedValue || value;
      }
    } else {
      sanitizedData[field] = value;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
};

/**
 * Server-side validation for API endpoints
 */
export const validateApiInput = (input: any, schema: Record<string, (value: any) => ValidationResult>): {
  isValid: boolean;
  errors: string[];
  sanitizedInput: any;
} => {
  const result = validateFormData(input, schema);
  
  return {
    isValid: result.isValid,
    errors: Object.values(result.errors),
    sanitizedInput: result.sanitizedData
  };
};

/**
 * Rate limiting helper (for client-side basic rate limiting)
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(private maxAttempts: number = 5, private windowMs: number = 15 * 60 * 1000) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true;
  }
  
  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxAttempts - validAttempts.length);
  }
  
  getResetTime(key: string): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;
    
    const oldestAttempt = Math.min(...attempts);
    return oldestAttempt + this.windowMs;
  }
}

// Export rate limiter instance for common use cases
export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
export const apiRateLimiter = new RateLimiter(100, 60 * 1000); // 100 requests per minute
