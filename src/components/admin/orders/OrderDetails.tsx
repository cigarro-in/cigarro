import { useState } from 'react';
import { 
  Package, 
  MapPin, 
  CreditCard, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock,
  Phone,
  Mail,
  User
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Separator } from '../../ui/separator';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { formatINR } from '../../../utils/currency';
import { ImageWithFallback } from '../../figma/ImageWithFallback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

interface OrderDetailsProps {
  order: any;
  onStatusUpdate: (orderId: string, status: string) => void;
  onPaymentVerification: (orderId: string, verified: 'YES' | 'NO' | 'REJECTED', reason?: string) => void;
  onClose: () => void;
}

export function OrderDetails({ order, onStatusUpdate, onPaymentVerification, onClose }: OrderDetailsProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleRejectPayment = () => {
    if (rejectionReason.trim()) {
      onPaymentVerification(order.id, 'REJECTED', rejectionReason);
      setShowRejectModal(false);
      setRejectionReason('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600';
      case 'shipped': return 'text-blue-600';
      case 'processing': return 'text-yellow-600';
      case 'placed': return 'text-orange-600';
      case 'cancelled': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPaymentColor = (verified: string) => {
    switch (verified) {
      case 'YES': return 'text-green-600';
      case 'NO': return 'text-yellow-600';
      case 'REJECTED': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Order Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Order #{order.display_order_id}</h2>
          <p className="text-sm text-gray-500">
            Placed on {new Date(order.created_at).toLocaleDateString()} at{' '}
            {new Date(order.created_at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={getStatusColor(order.status)}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
          <Badge variant="outline" className={getPaymentColor(order.payment_verified)}>
            Payment: {order.payment_verified === 'YES' ? 'Verified' : 
                     order.payment_verified === 'NO' ? 'Pending' : 'Rejected'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>{order.customerEmail}</span>
            </div>
            {order.customerPhone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{order.customerPhone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              Shipping Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div>{order.shipping_address}</div>
              <div>
                {order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}
              </div>
              <div>{order.shipping_country}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="mr-2 h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item: any, index: number) => (
              <div key={index} className="flex items-center space-x-4 p-3 bg-gray-100 rounded-lg border">
                <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden">
                  {item.image ? (
                    <ImageWithFallback
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{item.name}</h4>
                  <p className="text-sm text-gray-600">{item.brand}</p>
                  <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatINR(item.price)}</p>
                  <p className="text-sm text-gray-500">each</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatINR(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>{formatINR(order.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span>{formatINR(order.shipping)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>{formatINR(order.total)}</span>
            </div>
          </div>

          {order.payment_method && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Payment Method: <span className="font-medium">{order.payment_method}</span>
              </p>
              {order.transaction_id && (
                <p className="text-sm text-gray-600">
                  Transaction ID: <span className="font-mono">{order.transaction_id}</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Information */}
      {(order.tracking_number || order.shipping_company) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Truck className="mr-2 h-5 w-5" />
              Shipping Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.shipping_company && (
              <div className="flex justify-between">
                <span>Shipping Company:</span>
                <span className="font-medium">{order.shipping_company}</span>
              </div>
            )}
            {order.tracking_number && (
              <div className="flex justify-between">
                <span>Tracking Number:</span>
                <span className="font-mono">{order.tracking_number}</span>
              </div>
            )}
            {order.shipped_at && (
              <div className="flex justify-between">
                <span>Shipped At:</span>
                <span>{new Date(order.shipped_at).toLocaleString()}</span>
              </div>
            )}
            {order.estimated_delivery && (
              <div className="flex justify-between">
                <span>Estimated Delivery:</span>
                <span>{new Date(order.estimated_delivery).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t">
        {order.status === 'placed' && (
          <Button onClick={() => onStatusUpdate(order.id, 'processing')}>
            <Clock className="mr-2 h-4 w-4" />
            Mark as Processing
          </Button>
        )}
        
        {(order.status === 'placed' || order.status === 'processing') && (
          <Button onClick={() => onStatusUpdate(order.id, 'shipped')}>
            <Truck className="mr-2 h-4 w-4" />
            Mark as Shipped
          </Button>
        )}
        
        {order.status === 'shipped' && (
          <Button onClick={() => onStatusUpdate(order.id, 'delivered')}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark as Delivered
          </Button>
        )}

        {order.payment_verified === 'NO' && (
          <>
            <Button 
              variant="outline"
              onClick={() => onPaymentVerification(order.id, 'YES')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify Payment
            </Button>
            <Button 
              variant="destructive"
              onClick={() => setShowRejectModal(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject Payment
            </Button>
          </>
        )}

        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Payment Rejection Modal */}
      <AlertDialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this payment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter the reason for payment rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRejectModal(false);
              setRejectionReason('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectPayment}
              className="bg-red-600 hover:bg-red-700"
              disabled={!rejectionReason.trim()}
            >
              Reject Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
