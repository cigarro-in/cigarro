import { ChevronRight, QrCode, Wallet, ExternalLink } from 'lucide-react';

interface PaymentMethodsProps {
  selectedPaymentMethod: string;
  setSelectedPaymentMethod: (method: string) => void;
  setShowPaymentDialog: (show: boolean) => void;
  handleQRPayment: () => void;
  handleWalletPayment: () => void;
  walletBalance: number;
  getFinalTotal: () => number;
}

export function PaymentMethods({
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  setShowPaymentDialog,
  handleQRPayment,
  handleWalletPayment,
  walletBalance,
  getFinalTotal
}: PaymentMethodsProps) {
  return (
    <div className="space-y-3">
      {/* QR Code Option */}
      <button
        onClick={() => {
          setSelectedPaymentMethod('qr');
          setShowPaymentDialog(false);
          handleQRPayment();
        }}
        className="w-full p-4 bg-creme-light border-2 border-coyote/30 rounded-xl hover:border-canyon hover:bg-creme transition-all active:scale-95 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center flex-shrink-0 group-hover:bg-canyon transition-colors">
            <QrCode className="w-6 h-6 text-creme-light" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-dark text-sm">QR Code</p>
            <p className="text-xs text-dark/60 mt-0.5">Scan with any UPI app</p>
          </div>
          <ChevronRight className="w-5 h-5 text-dark/40 group-hover:text-canyon transition-colors" />
        </div>
      </button>

      {/* Wallet Option */}
      {walletBalance > 0 && (
        <button
          onClick={() => {
            setSelectedPaymentMethod('wallet');
            setShowPaymentDialog(false);
            handleWalletPayment();
          }}
          disabled={walletBalance < getFinalTotal()}
          className="w-full p-4 bg-creme-light border-2 border-coyote/30 rounded-xl hover:border-canyon hover:bg-creme transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center flex-shrink-0 group-hover:bg-canyon transition-colors">
              <Wallet className="w-6 h-6 text-creme-light" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-dark text-sm">Wallet</p>
              <p className="text-xs text-dark/60 mt-0.5">
                {walletBalance >= getFinalTotal() 
                  ? `Balance: ₹${walletBalance.toFixed(2)}` 
                  : 'Insufficient wallet balance'
                }
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-dark/40 group-hover:text-canyon transition-colors" />
          </div>
        </button>
      )}

      {/* Payment Link Option */}
      <button
        onClick={() => {
          setSelectedPaymentMethod('link');
          setShowPaymentDialog(false);
        }}
        className="w-full p-4 bg-creme-light border-2 border-coyote/30 rounded-xl hover:border-canyon hover:bg-creme transition-all active:scale-95 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center flex-shrink-0 group-hover:bg-canyon transition-colors">
            <ExternalLink className="w-6 h-6 text-creme-light" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-dark text-sm">Payment Link</p>
            <p className="text-xs text-dark/60 mt-0.5">Get payment link via SMS</p>
          </div>
          <ChevronRight className="w-5 h-5 text-dark/40 group-hover:text-canyon transition-colors" />
        </div>
      </button>
    </div>
  );
}
