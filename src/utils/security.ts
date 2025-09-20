/**
 * Security utilities for production-grade security measures
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in minutes
  passwordMinLength: number;
  requireSpecialChars: boolean;
}

class SecurityManager {
  private config: SecurityConfig = {
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    sessionTimeout: 60,
    passwordMinLength: 8,
    requireSpecialChars: true
  };

  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  /**
   * Check rate limiting for a given key (e.g., IP address, user email)
   */
  async checkRateLimit(key: string, maxAttempts: number = this.config.maxLoginAttempts): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.config.lockoutDuration * 60 * 1000; // Convert to milliseconds
    
    const record = this.rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      // Reset or create new record
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetTime: now + windowMs
      };
    }
    
    if (record.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      };
    }
    
    // Increment count
    record.count++;
    this.rateLimitStore.set(key, record);
    
    return {
      allowed: true,
      remaining: maxAttempts - record.count,
      resetTime: record.resetTime
    };
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`);
    }
    
    if (this.config.requireSpecialChars) {
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Hash sensitive data (client-side hashing for additional security)
   */
  async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if current session is valid
   */
  isSessionValid(sessionStart: number): boolean {
    const now = Date.now();
    const sessionDuration = this.config.sessionTimeout * 60 * 1000;
    return (now - sessionStart) < sessionDuration;
  }

  /**
   * Clear rate limit records (cleanup)
   */
  clearExpiredRateLimits(): void {
    const now = Date.now();
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (now > record.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

export const securityManager = new SecurityManager();

// Export individual functions for convenience
export const {
  checkRateLimit,
  validatePassword,
  sanitizeInput,
  validateEmail,
  generateSecureToken,
  hashData,
  isSessionValid
} = securityManager;
