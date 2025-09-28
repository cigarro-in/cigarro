import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { DashboardAnalytics } from '../types/index';

interface DashboardAnalyticsTabProps {
  analytics: DashboardAnalytics;
}

export function DashboardAnalyticsTab({ analytics }: DashboardAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{analytics.totalProducts}</div>
              <p className="text-sm text-muted-foreground">Total Products</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{analytics.activeProducts}</div>
              <p className="text-sm text-muted-foreground">Active Products</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{analytics.lowStockProducts}</div>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Inventory Value:</span>
                <span className="font-medium">₹{analytics.totalValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Products:</span>
                <span className="font-medium">{analytics.activeProducts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inactive Products:</span>
                <span className="font-medium">{analytics.totalProducts - analytics.activeProducts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product Variants:</span>
                <span className="font-medium">{analytics.totalVariants}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Low Stock Items:</span>
                <span className="font-medium text-orange-600">{analytics.lowStockProducts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Well Stocked:</span>
                <span className="font-medium text-green-600">
                  {analytics.totalProducts - analytics.lowStockProducts}
                </span>
              </div>
              {analytics.lowStockProducts > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    ⚠️ {analytics.lowStockProducts} items need restocking
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
