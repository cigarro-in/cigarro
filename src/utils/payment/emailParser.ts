/**
 * Email Parser for UPI Payment Confirmations
 * Extracts payment details from bank confirmation emails
 */

export interface ParsedPayment {
  bankName: string;
  amount: number;
  upiReference: string;
  senderVPA: string;
  receiverVPA: string;
  timestamp: Date;
  transactionId?: string; // Our TXN ID if found in email
}

export interface EmailData {
  subject: string;
  body: string;
  from: string;
  receivedAt: Date;
}

export interface BankTemplate {
  bank_name: string;
  email_domain: string;
  subject_pattern: string;
  amount_pattern: string;
  reference_pattern?: string;
  sender_vpa_pattern?: string;
  receiver_vpa_pattern?: string;
  transaction_id_pattern?: string;
  priority: number;
}

/**
 * Main email parser class
 */
export class EmailParser {
  private templates: BankTemplate[];

  constructor(templates: BankTemplate[]) {
    // Sort templates by priority (highest first)
    this.templates = templates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Parse an email and extract payment details
   */
  async parse(email: EmailData): Promise<ParsedPayment | null> {

    // Try each template in priority order
    for (const template of this.templates) {
      try {
        const parsed = this.tryParseWithTemplate(email, template);
        if (parsed) {

          return parsed;
        }
      } catch (error) {

      }
    }

    return null;
  }

  /**
   * Try to parse email with a specific template
   */
  private tryParseWithTemplate(
    email: EmailData,
    template: BankTemplate
  ): ParsedPayment | null {
    // Check if email domain matches (unless it's a wildcard)
    if (template.email_domain !== '*') {
      const emailDomain = email.from.toLowerCase();
      const templateDomain = template.email_domain.toLowerCase();
      
      if (!emailDomain.includes(templateDomain)) {
        return null;
      }
    }

    // Combine subject and body for pattern matching
    const text = `${email.subject}\n${email.body}`;

    // Extract amount (required field)
    const amount = this.extractAmount(text, template.amount_pattern);
    if (amount === null) {
      return null;
    }

    // Extract other fields (optional)
    const upiReference = template.reference_pattern
      ? this.extractField(text, template.reference_pattern)
      : '';

    const senderVPA = template.sender_vpa_pattern
      ? this.extractField(text, template.sender_vpa_pattern)
      : '';

    const receiverVPA = template.receiver_vpa_pattern
      ? this.extractField(text, template.receiver_vpa_pattern)
      : '';

    const transactionId = template.transaction_id_pattern
      ? this.extractField(text, template.transaction_id_pattern)
      : undefined;

    // Validate receiver VPA if found (should be hrejuh@upi)
    if (receiverVPA && !receiverVPA.includes('hrejuh')) {

      // Don't reject, but log warning
    }

    return {
      bankName: template.bank_name,
      amount,
      upiReference,
      senderVPA,
      receiverVPA,
      timestamp: email.receivedAt,
      transactionId,
    };
  }

  /**
   * Extract amount from text using regex pattern
   */
  private extractAmount(text: string, pattern: string): number | null {
    try {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);

      if (!match) {
        return null;
      }

      // Try to find the captured group with the amount
      const amountStr = match[1] || match[2] || match[0];
      
      // Remove currency symbols and commas
      const cleanAmount = amountStr
        .replace(/[₹Rs\.,\s]/gi, '')
        .trim();

      const amount = parseFloat(cleanAmount);

      if (isNaN(amount) || amount <= 0) {
        return null;
      }

      return amount;
    } catch (error) {
      console.error('Error extracting amount:', error);
      return null;
    }
  }

  /**
   * Extract a field from text using regex pattern
   */
  private extractField(text: string, pattern: string): string {
    try {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);

      if (!match) {
        return '';
      }

      // Return the first captured group, or the whole match
      return (match[1] || match[2] || match[3] || match[0]).trim();
    } catch (error) {
      console.error('Error extracting field:', error);
      return '';
    }
  }
}

/**
 * Default bank templates (can be overridden from database)
 */
export const DEFAULT_BANK_TEMPLATES: BankTemplate[] = [
  // PhonePe
  {
    bank_name: 'PhonePe',
    email_domain: 'phonepe.com',
    subject_pattern: 'Payment Successful|Money Sent',
    amount_pattern: '₹\\s*([0-9,]+(?:\\.[0-9]{2})?)',
    reference_pattern: 'UPI Ref[:\\s]+([A-Z0-9]+)',
    sender_vpa_pattern: 'From[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    receiver_vpa_pattern: 'To[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    transaction_id_pattern: 'TXN[0-9]{8}',
    priority: 10,
  },
  // Google Pay
  {
    bank_name: 'Google Pay',
    email_domain: 'google.com',
    subject_pattern: 'You sent ₹|Payment to',
    amount_pattern: '₹\\s*([0-9,]+(?:\\.[0-9]{2})?)',
    reference_pattern: 'UPI transaction ID[:\\s]+([A-Z0-9]+)',
    sender_vpa_pattern: 'From[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    receiver_vpa_pattern: 'To[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    transaction_id_pattern: 'TXN[0-9]{8}',
    priority: 10,
  },
  // Paytm
  {
    bank_name: 'Paytm',
    email_domain: 'paytm.com',
    subject_pattern: 'Payment Successful|Money Transferred',
    amount_pattern: '₹\\s*([0-9,]+(?:\\.[0-9]{2})?)',
    reference_pattern: 'Transaction ID[:\\s]+([A-Z0-9]+)',
    sender_vpa_pattern: 'From[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    receiver_vpa_pattern: 'To[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    transaction_id_pattern: 'TXN[0-9]{8}',
    priority: 9,
  },
  // BHIM
  {
    bank_name: 'BHIM',
    email_domain: 'npci.org.in',
    subject_pattern: 'Transaction Successful|Payment Confirmation',
    amount_pattern: '₹\\s*([0-9,]+(?:\\.[0-9]{2})?)',
    reference_pattern: 'RRN[:\\s]+([A-Z0-9]+)',
    sender_vpa_pattern: 'Payer VPA[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    receiver_vpa_pattern: 'Payee VPA[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    transaction_id_pattern: 'TXN[0-9]{8}',
    priority: 8,
  },
  // Generic UPI (fallback)
  {
    bank_name: 'Generic UPI',
    email_domain: '*',
    subject_pattern: 'UPI|Payment|Transaction',
    amount_pattern: '₹\\s*([0-9,]+(?:\\.[0-9]{2})?)|Rs\\.?\\s*([0-9,]+(?:\\.[0-9]{2})?)',
    reference_pattern: 'Reference[:\\s]+([A-Z0-9]+)|Ref[:\\s]+([A-Z0-9]+)|RRN[:\\s]+([A-Z0-9]+)',
    sender_vpa_pattern: 'From[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)|Payer[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    receiver_vpa_pattern: 'To[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)|Payee[:\\s]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)',
    transaction_id_pattern: 'TXN[0-9]{8}',
    priority: 1,
  },
];

/**
 * Validate parsed payment data
 */
export function validateParsedPayment(payment: ParsedPayment): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Amount must be positive
  if (payment.amount <= 0) {
    errors.push('Amount must be positive');
  }

  // Amount should be reasonable (between ₹1 and ₹100,000)
  if (payment.amount < 1 || payment.amount > 100000) {
    errors.push('Amount outside reasonable range');
  }

  // Receiver VPA should be hrejuh@upi
  if (payment.receiverVPA && !payment.receiverVPA.includes('hrejuh')) {
    errors.push('Receiver VPA does not match expected');
  }

  // Timestamp should be recent (within last hour)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (payment.timestamp < hourAgo) {
    errors.push('Payment timestamp too old');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Test the parser with sample emails
 */
export async function testEmailParser() {
  const parser = new EmailParser(DEFAULT_BANK_TEMPLATES);

  // Sample PhonePe email
  const phonepeEmail: EmailData = {
    subject: 'Payment Successful',
    body: `
      Dear Customer,
      
      Your payment of ₹1,234.56 to Cigarro was successful.
      
      From: customer@paytm
      To: hrejuh@upi
      UPI Ref: 123456789012
      Transaction: TXN12345678
      
      Thank you for using PhonePe!
    `,
    from: 'noreply@phonepe.com',
    receivedAt: new Date(),
  };

  const result = await parser.parse(phonepeEmail);

  if (result) {
    const validation = validateParsedPayment(result);

  }

  return result;
}
