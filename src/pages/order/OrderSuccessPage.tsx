import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Home, Package, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { formatINR } from '../../utils/currency';
import { Helmet } from 'react-helmet-async';

type LocationState = {
  message: string;
  orderId: string;
  amount?: number;
  itemCount?: number;
};

export function OrderSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { message, orderId, amount, itemCount } = (location.state || {}) as LocationState;

  return (
    <>
      <Helmet>
        <title>Order Success - Cigarro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <p className="text-muted-foreground">
                {message || 'Your order has been placed successfully'}
              </p>
            </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-muted/20 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-medium">{orderId || '--'}</p>
                </div>
              </div>
              
              {itemCount && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Items Ordered</p>
                    <p className="font-medium">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
                  </div>
                </div>
              )}
              
              {amount && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                    <p className="font-medium">{formatINR(amount)}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                  <p className="font-medium">3-5 business days</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                We've sent an order confirmation to your email
              </p>
              
              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  onClick={() => navigate('/orders')}
                  className="w-full"
                >
                  View Orders
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}

export default OrderSuccessPage;
