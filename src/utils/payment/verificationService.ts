/**
 * Payment Verification Service
 * Handles real-time payment status monitoring and verification
 */

import { supabase } from '../supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PaymentVerification {
  id: string;
  transaction_id: string;
  order_id: string | null;
  verification_status: 'pending' | 'verified' | 'failed' | 'duplicate' | 'manual';
  amount: number;
  bank_name: string;
  upi_reference: string;
  confidence_score: number;
  verified_at: string | null;
  created_at: string;
}

export interface OrderPaymentStatus {
  orderId: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered';
  paymentConfirmed: boolean;
  autoVerified: boolean;
  verificationId: string | null;
}

/**
 * Subscribe to real-time payment verification updates for an order
 */
export function subscribeToPaymentVerification(
  orderId: string,
  onStatusChange: (status: OrderPaymentStatus) => void
): RealtimeChannel {
  console.log('📡 Subscribing to payment updates for order:', orderId);

  const channel = supabase
    .channel(`order-payment-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        console.log('💰 Order payment status updated:', payload);
        
        const order = payload.new as any;
        
        onStatusChange({
          orderId: order.id,
          status: order.status,
          paymentConfirmed: order.payment_confirmed,
          autoVerified: order.auto_verified,
          verificationId: order.payment_verification_id,
        });
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });

  return channel;
}

/**
 * Unsubscribe from payment verification updates
 */
export async function unsubscribeFromPaymentVerification(
  channel: RealtimeChannel
): Promise<void> {
  await supabase.removeChannel(channel);
  console.log('📡 Unsubscribed from payment updates');
}

/**
 * Poll order payment status (fallback if realtime doesn't work)
 */
export async function pollPaymentStatus(
  orderId: string,
  onStatusChange: (status: OrderPaymentStatus) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 150 // 5 minutes at 2s intervals
): Promise<() => void> {
  let attempts = 0;
  let stopped = false;

  const poll = async () => {
    if (stopped || attempts >= maxAttempts) {
      console.log('⏹️ Stopped polling payment status');
      return;
    }

    attempts++;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, payment_confirmed, auto_verified, payment_verification_id')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('❌ Error polling payment status:', error);
      } else if (data) {
        onStatusChange({
          orderId: data.id,
          status: data.status,
          paymentConfirmed: data.payment_confirmed,
          autoVerified: data.auto_verified,
          verificationId: data.payment_verification_id,
        });

        // Stop polling if payment is confirmed
        if (data.payment_confirmed) {
          console.log('✅ Payment confirmed, stopping poll');
          stopped = true;
          return;
        }
      }
    } catch (error) {
      console.error('❌ Error in payment status poll:', error);
    }

    // Schedule next poll
    if (!stopped) {
      setTimeout(poll, intervalMs);
    }
  };

  // Start polling
  poll();

  // Return stop function
  return () => {
    stopped = true;
  };
}

/**
 * Get payment verification details
 */
export async function getPaymentVerification(
  verificationId: string
): Promise<PaymentVerification | null> {
  const { data, error } = await supabase
    .from('payment_verifications')
    .select('*')
    .eq('id', verificationId)
    .single();

  if (error) {
    console.error('Error fetching payment verification:', error);
    return null;
  }

  return data as PaymentVerification;
}

/**
 * Get all payment verifications for an order
 */
export async function getOrderVerifications(
  orderId: string
): Promise<PaymentVerification[]> {
  const { data, error } = await supabase
    .from('payment_verifications')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching order verifications:', error);
    return [];
  }

  return data as PaymentVerification[];
}

/**
 * Manually verify a payment (admin only)
 * @deprecated Use admin_verify_payment database function instead
 * This function has been removed for security reasons.
 * Admins should use the secure backend function through the admin panel.
 */
export async function manuallyVerifyPayment(
  orderId: string,
  verificationData: {
    amount: number;
    upiReference: string;
    bankName: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: 'This function has been deprecated. Use admin_verify_payment database function instead.',
  };
}

/**
 * Check if payment verification is available for an order
 */
export async function checkVerificationAvailable(
  transactionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('payment_verifications')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('verification_status', 'verified')
    .single();

  return !error && !!data;
}

/**
 * Get verification statistics (admin)
 */
export async function getVerificationStats(): Promise<{
  total: number;
  verified: number;
  pending: number;
  failed: number;
  successRate: number;
}> {
  const { data, error } = await supabase
    .from('payment_verifications')
    .select('verification_status');

  if (error || !data) {
    return {
      total: 0,
      verified: 0,
      pending: 0,
      failed: 0,
      successRate: 0,
    };
  }

  const total = data.length;
  const verified = data.filter((v) => v.verification_status === 'verified').length;
  const pending = data.filter((v) => v.verification_status === 'pending').length;
  const failed = data.filter((v) => v.verification_status === 'failed').length;
  const successRate = total > 0 ? (verified / total) * 100 : 0;

  return {
    total,
    verified,
    pending,
    failed,
    successRate,
  };
}
