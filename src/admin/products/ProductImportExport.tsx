import { useState } from 'react';
import { 
  Download, 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  X,
  FileSpreadsheet,
  Database,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Progress } from '../../components/ui/progress';
import { supabase } from '../../../lib/supabase/client';
import { toast } from 'sonner';
import { sanitizeString } from '../../../utils/validation';

interface ImportError {
  row: number;
  field: string;
  message: string;
  value: any;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulImports: number;
  errors: ImportError[];
  warnings: string[];
}

interface ProductImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export function ProductImportExport({ isOpen, onClose, onImportComplete }: ProductImportExportProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const loadMetadata = async () => {
    try {
      const [categoriesResult, brandsResult] = await Promise.all([
        supabase.from('categories').select('id, name').eq('is_active', true),
        supabase.from('brands').select('id, name').eq('is_active', true)
      ]);

      if (categoriesResult.data) setCategories(categoriesResult.data);
      if (brandsResult.data) setBrands(brandsResult.data);
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Load products with relationships
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name),
          brand:brands(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProgress(50);

      // Transform data for export
      const exportData = products?.map(product => ({
        'Product Name': product.name,
        'Description': product.description || '',
        'Short Description': product.short_description || '',
        'Price': product.price,
        'Compare Price': product.compare_price || '',
        'Cost Price': product.cost_price || '',
        'Stock': product.stock,
        'Barcode': product.barcode || '',
        'Category': product.category?.name || '',
        'Brand': product.brand?.name || '',
        'Weight': product.weight || '',
        'Origin': product.origin || '',
        'Strength': product.strength || '',
        'Pack Size': product.pack_size || '',
        'Image URL': product.image_url || '',
        'Is Active': product.is_active ? 'Yes' : 'No',
        'Is Featured': product.is_featured ? 'Yes' : 'No',
        'Is Digital': product.is_digital ? 'Yes' : 'No',
        'Requires Shipping': product.requires_shipping ? 'Yes' : 'No',
        'Meta Title': product.meta_title || '',
        'Meta Description': product.meta_description || '',
        'Created At': product.created_at,
        'Updated At': product.updated_at
      })) || [];

      setProgress(75);

      // Convert to CSV
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = (row as any)[header];
            // Escape quotes and wrap in quotes if contains comma or quote
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      setProgress(90);

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setProgress(100);
      toast.success(`Exported ${exportData.length} products successfully`);

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export products');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setSelectedFile(file);
    previewFile(file);
  };

  const previewFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Preview first 5 rows
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setPreviewData(preview);
    };
    reader.readAsText(file);
  };

  const validateRow = (row: any, rowIndex: number): ImportError[] => {
    const errors: ImportError[] = [];

    // Required fields validation
    if (!row['Product Name']?.trim()) {
      errors.push({
        row: rowIndex,
        field: 'Product Name',
        message: 'Product name is required',
        value: row['Product Name']
      });
    }

    if (!row['Price'] || isNaN(parseFloat(row['Price']))) {
      errors.push({
        row: rowIndex,
        field: 'Price',
        message: 'Valid price is required',
        value: row['Price']
      });
    }

    if (row['Stock'] && isNaN(parseInt(row['Stock']))) {
      errors.push({
        row: rowIndex,
        field: 'Stock',
        message: 'Stock must be a number',
        value: row['Stock']
      });
    }

    // Email validation for any email fields
    // URL validation for image URLs
    if (row['Image URL'] && row['Image URL'].trim() && !row['Image URL'].match(/^https?:\/\/.+/)) {
      errors.push({
        row: rowIndex,
        field: 'Image URL',
        message: 'Invalid URL format',
        value: row['Image URL']
      });
    }

    return errors;
  };

  const findCategoryId = (categoryName: string): string | null => {
    const category = categories.find(c => 
      c.name.toLowerCase() === categoryName.toLowerCase()
    );
    return category?.id || null;
  };

  const findBrandId = (brandName: string): string | null => {
    const brand = brands.find(b => 
      b.name.toLowerCase() === brandName.toLowerCase()
    );
    return brand?.id || null;
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setImportResult(null);

    try {
      await loadMetadata();
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const totalRows = lines.length - 1;
        let successfulImports = 0;
        const allErrors: ImportError[] = [];
        const warnings: string[] = [];

        setProgress(10);

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            // Validate row
            const rowErrors = validateRow(row, i);
            if (rowErrors.length > 0) {
              allErrors.push(...rowErrors);
              continue;
            }

            // Find category and brand IDs
            const categoryId = row['Category'] ? findCategoryId(row['Category']) : null;
            const brandId = row['Brand'] ? findBrandId(row['Brand']) : null;

            if (row['Category'] && !categoryId) {
              warnings.push(`Row ${i}: Category "${row['Category']}" not found, will be left empty`);
            }

            if (row['Brand'] && !brandId) {
              warnings.push(`Row ${i}: Brand "${row['Brand']}" not found, will be left empty`);
            }

            // Prepare product data
            const productData = {
              name: sanitizeString(row['Product Name'] || ''),
              description: sanitizeString(row['Description'] || ''),
              short_description: sanitizeString(row['Short Description'] || ''),
              price: parseFloat(row['Price']),
              compare_price: row['Compare Price'] ? parseFloat(row['Compare Price']) : null,
              cost_price: row['Cost Price'] ? parseFloat(row['Cost Price']) : null,
              stock: parseInt(row['Stock']) || 0,
              barcode: sanitizeString(row['Barcode'] || ''),
              category_id: categoryId,
              brand_id: brandId,
              weight: row['Weight'] ? parseFloat(row['Weight']) : null,
              origin: sanitizeString(row['Origin'] || ''),
              strength: sanitizeString(row['Strength'] || ''),
              pack_size: sanitizeString(row['Pack Size'] || ''),
              image_url: sanitizeString(row['Image URL'] || ''),
              is_active: row['Is Active']?.toLowerCase() === 'yes',
              is_featured: row['Is Featured']?.toLowerCase() === 'yes',
              is_digital: row['Is Digital']?.toLowerCase() === 'yes',
              requires_shipping: row['Requires Shipping']?.toLowerCase() !== 'no',
              meta_title: sanitizeString(row['Meta Title'] || ''),
              meta_description: sanitizeString(row['Meta Description'] || ''),
              slug: row['Product Name'].toLowerCase()
                .replace(/[^a-z0-9 -]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim()
            };

            // Insert product
            const { error: insertError } = await supabase
              .from('products')
              .insert(productData);

            if (insertError) {
              allErrors.push({
                row: i,
                field: 'Database',
                message: insertError.message,
                value: productData.name
              });
            } else {
              successfulImports++;
            }

          } catch (error) {
            allErrors.push({
              row: i,
              field: 'General',
              message: error instanceof Error ? error.message : 'Unknown error',
              value: 'N/A'
            });
          }

          // Update progress
          setProgress(10 + (i / totalRows) * 80);
        }

        setProgress(100);

        const result: ImportResult = {
          success: allErrors.length === 0,
          totalRows,
          successfulImports,
          errors: allErrors,
          warnings
        };

        setImportResult(result);

        if (successfulImports > 0) {
          toast.success(`Successfully imported ${successfulImports} products`);
          if (onImportComplete) {
            onImportComplete();
          }
        }

        if (allErrors.length > 0) {
          toast.error(`Import completed with ${allErrors.length} errors`);
        }
      };

      reader.readAsText(selectedFile);

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import products');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'Product Name,Description,Short Description,Price,Compare Price,Cost Price,Stock,Barcode,Category,Brand,Weight,Origin,Strength,Pack Size,Image URL,Is Active,Is Featured,Is Digital,Requires Shipping,Meta Title,Meta Description',
      'Sample Product,"A great product description","Short desc",29.99,39.99,20.00,100,1234567890123,Premium Cigarettes,Marlboro,0.05,USA,Regular,Pack of 20,https://example.com/image.jpg,Yes,No,No,Yes,"Sample Product - Premium Quality","Buy our sample product online"'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'product_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Template downloaded successfully');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Product Import/Export</DialogTitle>
          <DialogDescription>
            Import products from CSV files or export existing products for backup and migration
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Products
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Export Products to CSV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This will export all products with their complete details including categories, brands, and metadata.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleExport} 
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isProcessing ? 'Exporting...' : 'Export Products'}
                  </Button>

                  {isProcessing && (
                    <div className="flex-1">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Exporting products... {progress}%
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Import Products from CSV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Make sure your CSV file follows the correct format. Download the template to get started.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
                    onClick={downloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Download Template
                  </Button>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>

                {selectedFile && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">File Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-4">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span className="font-medium">{selectedFile.name}</span>
                        <Badge variant="secondary">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </Badge>
                      </div>

                      {previewData.length > 0 && (
                        <div className="border rounded-lg overflow-auto max-h-64">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {Object.keys(previewData[0]).map(header => (
                                  <TableHead key={header} className="text-xs">
                                    {header}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewData.map((row, index) => (
                                <TableRow key={index}>
                                  {Object.values(row).map((value: any, i) => (
                                    <TableCell key={i} className="text-xs">
                                      {String(value).substring(0, 30)}
                                      {String(value).length > 30 ? '...' : ''}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-4">
                        <Button 
                          onClick={handleImport} 
                          disabled={isProcessing || !selectedFile}
                          className="flex items-center gap-2"
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {isProcessing ? 'Importing...' : 'Import Products'}
                        </Button>

                        {isProcessing && (
                          <div className="flex-1">
                            <Progress value={progress} className="w-full" />
                            <p className="text-sm text-muted-foreground mt-1">
                              Processing import... {progress}%
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Import Results */}
                {importResult && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {importResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        )}
                        Import Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{importResult.totalRows}</p>
                          <p className="text-sm text-muted-foreground">Total Rows</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {importResult.successfulImports}
                          </p>
                          <p className="text-sm text-muted-foreground">Successful</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">
                            {importResult.errors.length}
                          </p>
                          <p className="text-sm text-muted-foreground">Errors</p>
                        </div>
                      </div>

                      {importResult.warnings.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Warnings:</strong>
                            <ul className="mt-2 list-disc list-inside">
                              {importResult.warnings.slice(0, 5).map((warning, index) => (
                                <li key={index} className="text-sm">{warning}</li>
                              ))}
                              {importResult.warnings.length > 5 && (
                                <li className="text-sm">
                                  ... and {importResult.warnings.length - 5} more warnings
                                </li>
                              )}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {importResult.errors.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Import Errors:</h4>
                          <div className="border rounded-lg overflow-auto max-h-64">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Row</TableHead>
                                  <TableHead>Field</TableHead>
                                  <TableHead>Error</TableHead>
                                  <TableHead>Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {importResult.errors.slice(0, 20).map((error, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{error.row}</TableCell>
                                    <TableCell>{error.field}</TableCell>
                                    <TableCell className="text-red-600">
                                      {error.message}
                                    </TableCell>
                                    <TableCell className="max-w-32 truncate">
                                      {String(error.value)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {importResult.errors.length > 20 && (
                              <p className="p-4 text-sm text-muted-foreground text-center">
                                ... and {importResult.errors.length - 20} more errors
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

