/**
 * Format amount in INR with proper comma placement
 * Indian numbering system: 1,00,000 (not 100,000)
 */
export function formatINR(amount: number | undefined | null): string {
  // Handle undefined/null values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0.00';
  }
  
  // Convert to string and handle decimals
  const [integerPart, decimalPart] = amount.toFixed(2).split('.');
  
  // Apply Indian numbering system
  const lastThreeDigits = integerPart.slice(-3);
  const remainingDigits = integerPart.slice(0, -3);
  
  let formattedInteger = lastThreeDigits;
  
  if (remainingDigits) {
    // Add commas every 2 digits for the remaining part
    const reversedRemaining = remainingDigits.split('').reverse().join('');
    const chunked = reversedRemaining.match(/.{1,2}/g) || [];
    const formattedRemaining = chunked.map(chunk => chunk.split('').reverse().join('')).reverse().join(',');
    formattedInteger = formattedRemaining + ',' + lastThreeDigits;
  }
  
  return `₹${formattedInteger}.${decimalPart}`;
}

/**
 * Format amount in INR without decimals for whole numbers
 */
export function formatINRWholeNumber(amount: number | undefined | null): string {
  // Handle undefined/null values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  
  const integerPart = Math.floor(amount).toString();
  
  const lastThreeDigits = integerPart.slice(-3);
  const remainingDigits = integerPart.slice(0, -3);
  
  let formattedInteger = lastThreeDigits;
  
  if (remainingDigits) {
    const reversedRemaining = remainingDigits.split('').reverse().join('');
    const chunked = reversedRemaining.match(/.{1,2}/g) || [];
    const formattedRemaining = chunked.map(chunk => chunk.split('').reverse().join('')).reverse().join(',');
    formattedInteger = formattedRemaining + ',' + lastThreeDigits;
  }
  
  return `₹${formattedInteger}`;
}
