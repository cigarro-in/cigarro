import { useState } from 'react';
import * as XLSX from 'xlsx';
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
import { supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { sanitizeString } from '../../utils/validation';

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
    console.log('Loading metadata (categories/brands)...');
    try {
      const [categoriesResult, brandsResult] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('brands').select('id, name').eq('is_active', true)
      ]);

      console.log('Metadata loaded:', {
        categories: categoriesResult.data?.length,
        brands: brandsResult.data?.length,
        catError: categoriesResult.error,
        brandError: brandsResult.error
      });

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
        'Category': product.category?.name || '',
        'Brand': product.brand?.name || '',
        'Origin': product.origin || '',
        'Pack Size': product.pack_size || '',
        'Image URL': product.image_url || '',
        'Gallery Images': (product.gallery_images || []).join(', '),
        'Specifications': product.specifications ? Object.entries(product.specifications).map(([k, v]) => `${k}:${v}`).join('; ') : '',
        'Is Active': product.is_active ? 'Yes' : 'No',
        'Is Featured': product.is_featured ? 'Yes' : 'No',
        'Meta Title': product.meta_title || '',
        'Meta Description': product.meta_description || '',
        // Variant fields (empty for main product row)
        'Variant Name': '',
        'Variant Type': '',
        'Variant Price': '',
        'Variant Stock': ''
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

    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setSelectedFile(file);
    previewFile(file);
  };

  const previewFile = (file: File) => {
    const reader = new FileReader();
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    reader.onload = (e) => {
      try {
        let data: any[] = [];
        
        if (fileExtension === '.csv') {
          // CSV parsing
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          data = lines.slice(1, 6).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          });
        } else {
          // Excel parsing
          const binaryStr = e.target?.result;
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          // Preview first 5 rows
          data = jsonData.slice(0, 5);
        }

        setPreviewData(data);
      } catch (error) {
        console.error('Preview error:', error);
        toast.error('Failed to preview file');
      }
    };

    if (fileExtension === '.csv') {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
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

    // Variant validation
    if (row['Variant Name'] && (!row['Variant Price'] || isNaN(parseFloat(row['Variant Price'])))) {
      errors.push({
        row: rowIndex,
        field: 'Variant Price',
        message: 'Variant price is required if variant name is present',
        value: row['Variant Price']
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
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      reader.onload = async (e) => {
        let rows: any[] = [];
        
        try {
          if (fileExtension === '.csv') {
            // CSV parsing
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').replace(/\*/g, ''));
            
            rows = lines.slice(1).map(line => {
              const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              return row;
            });
          } else {
            // Excel parsing
            const binaryStr = e.target?.result;
            const workbook = XLSX.read(binaryStr, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(firstSheet, { 
              raw: false,
              defval: ''
            });
            
            // Remove asterisks from column names
            rows = rows.map(row => {
              const cleanRow: any = {};
              Object.keys(row).forEach(key => {
                const cleanKey = key.replace(/\*/g, '').trim();
                cleanRow[cleanKey] = row[key];
              });
              return cleanRow;
            });
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          toast.error('Failed to parse file. Please check the file format.');
          setIsProcessing(false);
          return;
        }
        
          const totalRows = rows.length;
        console.log(`File parsed. Total rows: ${totalRows}`);
        
        let successfulImports = 0;
        const allErrors: ImportError[] = [];
        const warnings: string[] = [];

        setProgress(10);

        // Group rows by Product Name
        const productGroups: Record<string, any[]> = {};
        rows.forEach((row, index) => {
          const productName = row['Product Name']?.trim();
          if (productName) {
            if (!productGroups[productName]) {
              productGroups[productName] = [];
            }
            productGroups[productName].push({ ...row, _rowIndex: index + 2 });
          } else {
             console.warn(`Row ${index + 2} skipped: Missing Product Name`);
          }
        });

        const productsToProcess = Object.entries(productGroups);
        const totalProducts = productsToProcess.length;
        console.log(`Found ${totalProducts} unique products to process.`);

        for (let pIndex = 0; pIndex < totalProducts; pIndex++) {
          const [productName, productRows] = productsToProcess[pIndex];
          console.log(`Processing product: "${productName}" with ${productRows.length} rows`);
          
          const mainRow = productRows[0]; // Use first row for main product data

          try {
            // Validate all rows for this product
            let hasErrors = false;
            for (const row of productRows) {
              const rowErrors = validateRow(row, row._rowIndex);
              if (rowErrors.length > 0) {
                console.error(`Validation errors for row ${row._rowIndex}:`, rowErrors);
                allErrors.push(...rowErrors);
                hasErrors = true;
              }
            }
            if (hasErrors) {
                console.warn(`Skipping product "${productName}" due to validation errors.`);
                continue;
            }

            // Find category and brand IDs
            const categoryId = mainRow['Category'] ? findCategoryId(mainRow['Category']) : null;
            const brandId = mainRow['Brand'] ? findBrandId(mainRow['Brand']) : null;

            if (mainRow['Category'] && !categoryId) {
              warnings.push(`Row ${mainRow._rowIndex}: Category "${mainRow['Category']}" not found`);
            }
            if (mainRow['Brand'] && !brandId) {
              warnings.push(`Row ${mainRow._rowIndex}: Brand "${mainRow['Brand']}" not found`);
            }

            // Parse Specifications (Format: "Key:Value; Key2:Value2")
            const specifications: Record<string, string> = {};
            if (mainRow['Specifications']) {
              mainRow['Specifications'].split(';').forEach((spec: string) => {
                const [key, value] = spec.split(':');
                if (key && value) specifications[key.trim()] = value.trim();
              });
            }

            // Parse Gallery Images (Format: "url1, url2, url3")
            const galleryImages = mainRow['Gallery Images'] 
              ? mainRow['Gallery Images'].split(',').map((url: string) => url.trim()).filter(Boolean)
              : [];

            // Prepare product data
            const productData = {
              name: sanitizeString(productName),
              description: sanitizeString(mainRow['Description'] || ''),
              short_description: sanitizeString(mainRow['Short Description'] || ''),
              price: parseFloat(mainRow['Price']),
              compare_at_price: mainRow['Compare Price'] ? parseFloat(mainRow['Compare Price']) : null,
              cost_price: mainRow['Cost Price'] ? parseFloat(mainRow['Cost Price']) : null,
              stock: parseInt(mainRow['Stock']) || 0,
              brand_id: brandId,
              brand: mainRow['Brand'] ? sanitizeString(mainRow['Brand']) : null, // Populate legacy brand column
              origin: sanitizeString(mainRow['Origin'] || ''),
              pack_size: sanitizeString(mainRow['Pack Size'] || ''),
              image_url: sanitizeString(mainRow['Image URL'] || ''),
              gallery_images: galleryImages,
              specifications: specifications,
              is_active: mainRow['Is Active'] ? mainRow['Is Active']?.toLowerCase() === 'yes' : true, // Default to true if missing
              is_featured: mainRow['Is Featured']?.toLowerCase() === 'yes',
              meta_title: sanitizeString(mainRow['Meta Title'] || ''),
              meta_description: sanitizeString(mainRow['Meta Description'] || ''),
              slug: productName.toLowerCase()
                .replace(/[^a-z0-9 -]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim()
            };

            // Insert Product
            console.log('Attempting to insert product:', productData);
            const { data: insertedProduct, error: insertError } = await supabase
              .from('products')
              .insert(productData)
              .select()
              .single();

            if (insertError) {
              console.error('Supabase insert error:', insertError);
              // Check for duplicate slug
              if (insertError.code === '23505' && insertError.message.includes('slug')) {
                 // Try to update existing? For now just error
                 allErrors.push({
                  row: mainRow._rowIndex,
                  field: 'Product Name',
                  message: 'Product already exists (duplicate name/slug)',
                  value: productName
                });
              } else {
                allErrors.push({
                  row: mainRow._rowIndex,
                  field: 'Database',
                  message: `Insert failed: ${insertError.message} (${insertError.code})`,
                  value: productName
                });
              }
              continue;
            }
            
            console.log('Successfully inserted product:', insertedProduct);

            // Process Category Relationship
            if (categoryId && insertedProduct) {
               await supabase.from('product_categories').insert({
                 product_id: insertedProduct.id,
                 category_id: categoryId
               });
            }

            // Process Variants (if any)
            // A row is a variant if it has 'Variant Name' OR if there are multiple rows
            // Strategy: Iterate ALL rows. If 'Variant Name' is present, create variant.
            const variantsToInsert = [];
            
            for (const row of productRows) {
              if (row['Variant Name']) {
                variantsToInsert.push({
                  product_id: insertedProduct.id,
                  variant_name: sanitizeString(row['Variant Name']),
                  variant_type: sanitizeString(row['Variant Type'] || 'packaging'),
                  price: parseFloat(row['Variant Price'] || row['Price']), // Fallback to product price
                  stock: parseInt(row['Variant Stock']) || 0,
                  compare_at_price: row['Compare Price'] ? parseFloat(row['Compare Price']) : null, // Inherit or override? Let's assume inherit if not present? No, simple for now.
                  cost_price: row['Cost Price'] ? parseFloat(row['Cost Price']) : null,
                  is_active: true
                });
              }
            }

            if (variantsToInsert.length > 0) {
              const { error: variantError } = await supabase
                .from('product_variants')
                .insert(variantsToInsert);
              
              if (variantError) {
                warnings.push(`Failed to import variants for "${productName}": ${variantError.message}`);
              }
            }

            successfulImports++;

          } catch (error) {
            allErrors.push({
              row: mainRow._rowIndex,
              field: 'General',
              message: error instanceof Error ? error.message : 'Unknown error',
              value: productName
            });
          }

          // Update progress
          setProgress(10 + ((pIndex + 1) / totalProducts) * 80);
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

      if (fileExtension === '.csv') {
        reader.readAsText(selectedFile);
      } else {
        reader.readAsBinaryString(selectedFile);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import products');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    // Create workbook with formatted template
    const templateData = [
      {
        'Product Name': 'Marlboro Red',
        'Description': 'Premium quality cigarettes with rich tobacco flavor',
        'Short Description': 'Classic Marlboro Red cigarettes',
        'Price': 450,
        'Compare Price': 500,
        'Cost Price': 350,
        'Stock': 100,
        'Category': 'Premium Cigarettes',
        'Brand': 'Marlboro',
        'Origin': 'USA',
        'Pack Size': 'Pack of 20',
        'Image URL': 'https://example.com/marlboro.jpg',
        'Gallery Images': 'https://example.com/img1.jpg, https://example.com/img2.jpg',
        'Specifications': 'Strength:Strong; Ring Gauge:20',
        'Is Active': 'Yes',
        'Is Featured': 'No',
        'Meta Title': 'Marlboro Red',
        'Meta Description': 'Best cigarettes',
        'Variant Name': 'Single Pack',
        'Variant Type': 'packaging',
        'Variant Price': 450,
        'Variant Stock': 100
      },
      {
        'Product Name': 'Marlboro Red',
        'Description': 'SAME PRODUCT - NEW VARIANT',
        'Short Description': '',
        'Price': 450,
        'Compare Price': '',
        'Cost Price': '',
        'Stock': '',
        'Category': '',
        'Brand': '',
        'Origin': '',
        'Pack Size': '',
        'Image URL': '',
        'Gallery Images': '',
        'Specifications': '',
        'Is Active': '',
        'Is Featured': '',
        'Meta Title': '',
        'Meta Description': '',
        'Variant Name': 'Carton (10 Packs)',
        'Variant Type': 'packaging',
        'Variant Price': 4200,
        'Variant Stock': 10
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // Product Name*
      { wch: 30 }, // Description
      { wch: 20 }, // Short Description
      { wch: 10 }, // Price*
      { wch: 12 }, // Compare Price
      { wch: 12 }, // Cost Price
      { wch: 8 },  // Stock
      { wch: 20 }, // Category
      { wch: 15 }, // Brand
      { wch: 12 }, // Origin
      { wch: 15 }, // Pack Size
      { wch: 20 }, // Image URL
      { wch: 20 }, // Gallery Images
      { wch: 25 }, // Specifications
      { wch: 10 }, // Is Active
      { wch: 12 }, // Is Featured
      { wch: 20 }, // Meta Title
      { wch: 20 }, // Meta Description
      { wch: 20 }, // Variant Name
      { wch: 15 }, // Variant Type
      { wch: 12 }, // Variant Price
      { wch: 12 }  // Variant Stock
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    
    // Add instructions sheet
    const instructions = [
      { 'Field': 'Product Name*', 'Required': 'YES', 'Description': 'Product Name. Rows with SAME name will be grouped as variants.', 'Example': 'Marlboro Red' },
      { 'Field': 'Variant Name', 'Required': 'NO', 'Description': 'Name of variant (e.g., "Carton", "Pack"). If present, creates a variant.', 'Example': 'Carton' },
      { 'Field': 'Specifications', 'Required': 'NO', 'Description': 'Key:Value pairs separated by semicolon', 'Example': 'Strength:Medium; Origin:Cuba' },
      { 'Field': 'Gallery Images', 'Required': 'NO', 'Description': 'Comma separated URLs', 'Example': 'url1.jpg, url2.jpg' }
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 60 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    
    // Download file
    XLSX.writeFile(workbook, `product_import_template_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('Excel template downloaded successfully');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Product Import/Export</DialogTitle>
          <DialogDescription>
            Import products from Excel (.xlsx, .xls) or CSV files. Export existing products for backup and migration.
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
                  Import Products from Excel/CSV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Supported formats:</strong> Excel (.xlsx, .xls) or CSV (.csv)<br />
                    <strong>Required columns:</strong> Product Name*, Price*<br />
                    Download the template to get started with pre-filled examples.
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
                      accept=".csv,.xlsx,.xls"
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

