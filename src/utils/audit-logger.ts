/**
 * Audit logging utility for security and compliance
 */

import { supabase } from './supabase/client';
import { logger } from './logger';

interface AuditEvent {
  action: string;
  resource?: string;
  resource_id?: string;
  user_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityEvent extends AuditEvent {
  action: 'admin_login' | 'admin_logout' | 'admin_login_failed' | 'admin_access' | 'admin_access_changed' | 'unauthorized_access' | 'suspicious_activity';
}

class AuditLogger {
  private isProduction = import.meta.env?.PROD || false;
  private batchSize = 10;
  private batchTimeout = 5000; // 5 seconds
  private eventQueue: AuditEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  /**
   * Log a security-related event
   */
  async logSecurityEvent(action: SecurityEvent['action'], details: Omit<SecurityEvent, 'action'>): Promise<void> {
    const event: AuditEvent = {
      action,
      ...details,
      severity: this.getSecurityEventSeverity(action),
      user_agent: this.getUserAgent(),
    };

    await this.logEvent(event);
  }

  /**
   * Log a general audit event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      ip_address: event.ip_address || await this.getClientIP(),
      user_agent: event.user_agent || this.getUserAgent(),
      severity: event.severity || 'low'
    };

    // In development, log to console
    if (!this.isProduction) {
      logger.info('Audit Event:', auditEvent);
      return;
    }

    // In production, batch events for efficiency
    this.eventQueue.push(auditEvent);
    
    if (this.eventQueue.length >= this.batchSize) {
      await this.flushEvents();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushEvents(), this.batchTimeout);
    }
  }

  /**
   * Log user action for compliance
   */
  async logUserAction(userId: string, action: string, resource?: string, resourceId?: string, details?: Record<string, any>): Promise<void> {
    await this.logEvent({
      action,
      resource,
      resource_id: resourceId,
      user_id: userId,
      details,
      severity: 'low'
    });
  }

  /**
   * Log data access for compliance
   */
  async logDataAccess(userId: string, resource: string, resourceId: string, action: 'read' | 'write' | 'delete'): Promise<void> {
    await this.logEvent({
      action: `data_${action}`,
      resource,
      resource_id: resourceId,
      user_id: userId,
      severity: action === 'delete' ? 'high' : 'medium'
    });
  }

  /**
   * Log admin action for compliance
   */
  async logAction(resource: string, action: string, resourceId: string, oldData?: any, newData?: any): Promise<void> {
    await this.logEvent({
      action: `${resource}_${action}`,
      resource,
      resource_id: resourceId,
      details: {
        old_data: oldData,
        new_data: newData
      },
      severity: 'medium'
    });
  }

  /**
   * Log error for monitoring
   */
  async logError(error: Error, context?: Record<string, any>): Promise<void> {
    await this.logEvent({
      action: 'error',
      details: {
        message: error.message,
        stack: error.stack,
        ...context
      },
      severity: 'high'
    });
  }

  /**
   * Flush queued events to database
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      // Insert events into audit_logs table
      const { error } = await supabase
        .from('audit_logs')
        .insert(events.map(event => ({
          action: event.action,
          resource: event.resource,
          resource_id: event.resource_id,
          user_id: event.user_id,
          details: event.details,
          ip_address: event.ip_address,
          user_agent: event.user_agent,
          severity: event.severity,
          created_at: new Date().toISOString()
        })));

      if (error) {
        logger.error('Failed to insert audit logs:', error);
        // In case of failure, we could implement a fallback mechanism
        // such as storing in localStorage or sending to an external service
      }
    } catch (error) {
      logger.error('Error flushing audit events:', error);
    }
  }

  /**
   * Get security event severity
   */
  private getSecurityEventSeverity(action: SecurityEvent['action']): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<SecurityEvent['action'], 'low' | 'medium' | 'high' | 'critical'> = {
      'admin_login': 'medium',
      'admin_logout': 'low',
      'admin_login_failed': 'high',
      'admin_access': 'medium',
      'admin_access_changed': 'high',
      'unauthorized_access': 'critical',
      'suspicious_activity': 'high'
    };

    return severityMap[action] || 'low';
  }

  /**
   * Get client IP address (placeholder implementation)
   */
  private async getClientIP(): Promise<string> {
    try {
      // In a real implementation, you might want to use a service to get the IP
      // or extract it from request headers in a server-side context
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }

  /**
   * Force flush all pending events (useful for cleanup)
   */
  async forceFlush(): Promise<void> {
    await this.flushEvents();
  }
}

export const auditLogger = new AuditLogger();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    auditLogger.forceFlush();
  });
}
