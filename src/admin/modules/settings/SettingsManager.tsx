import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase/client';
import { Save, RefreshCw } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export function SettingsManager() {
  const [upiId, setUpiId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'upi_id')
        .single();

      if (error) throw error;

      if (data) {
        setUpiId(data.value);
        setLastUpdated(data.updated_at);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!upiId.trim()) {
      toast.error('UPI ID cannot be empty');
      return;
    }

    // Basic UPI ID validation (alphanumeric@provider)
    const upiPattern = /^[\w.-]+@[\w.-]+$/;
    if (!upiPattern.test(upiId.trim())) {
      toast.error('Invalid UPI ID format. Expected format: username@provider');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: upiId.trim(),
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('key', 'upi_id');

      if (error) throw error;

      toast.success('UPI ID updated successfully');
      await fetchSettings(); // Refresh to get updated timestamp
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update UPI ID');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Manage global application settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Settings</CardTitle>
          <CardDescription>
            Configure payment gateway settings for your store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="upi-id">UPI ID</Label>
            <Input
              id="upi-id"
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="username@upi"
              className="max-w-md"
            />
            <p className="text-sm text-gray-500">
              This UPI ID will be used for all payment transactions. Format: username@provider
            </p>
            {lastUpdated && (
              <p className="text-xs text-gray-400">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-dark text-creme-light hover:bg-canyon"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={fetchSettings}
              disabled={isSaving}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>Changing the UPI ID will affect all new orders immediately</li>
            <li>Existing pending orders will continue to use the old UPI ID</li>
            <li>Make sure the UPI ID is active and can receive payments</li>
            <li>Test the new UPI ID with a small transaction before going live</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
