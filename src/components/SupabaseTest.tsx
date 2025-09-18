import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase/client';

export function SupabaseTest() {
    const [testResult, setTestResult] = useState<string>('Testing Supabase connection...');

    useEffect(() => {
        async function testConnection() {
            try {
                // Simple test query
                // First, test the connection with a simple query
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id');

                if (error) {
                    console.error('Supabase test error:', error);
                    setTestResult(`❌ Error connecting to Supabase: ${error.message}`);
                    return;
                }

                setTestResult(`✅ Successfully connected to Supabase! Response received: ${JSON.stringify(data)}`);
                
            } catch (err) {
                console.error('Test error:', err);
                setTestResult(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        testConnection();
    }, []);

    return (
        <div style={{ 
            position: 'fixed', 
            bottom: 20, 
            left: 20, 
            padding: '10px', 
            background: '#333', 
            color: 'white', 
            borderRadius: '5px',
            zIndex: 9999
        }}>
            {testResult}
        </div>
    );
}