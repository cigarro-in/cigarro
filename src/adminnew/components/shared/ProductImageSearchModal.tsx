import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import {
    Loader2,
    Search,
    Check,
    ImageIcon,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Save,
    CheckCircle,
    X,
    AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../components/ui/utils';
import { supabase } from '../../../lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface ImageResult {
    url: string;
    thumbnail: string;
    title?: string;
    source?: string;
    width?: number;
    height?: number;
}

interface Product {
    id: string;
    name: string;
    slug: string;
    brand?: string;
    image_url?: string;
    gallery_images?: string[];
}

interface ProductImageSearchModalProps {
    open: boolean;
    onClose: () => void;
    product?: Product;
    products?: Product[];
    onImagesAdded?: (productId: string, imageUrls: string[]) => void;
    mode?: 'single' | 'browse';
}

interface SavedProduct {
    productId: string;
    name: string;
    status: 'saving' | 'done' | 'error';
    count: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const IMAGES_PER_PAGE = 16;

// API endpoint - use production URL in dev since Cloudflare Functions don't run locally
const API_BASE = import.meta.env.DEV ? 'https://cigarro.in' : '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchImageResults(query: string): Promise<ImageResult[]> {
    try {
        const response = await fetch(`${API_BASE}/api/images/search?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.images || [];
    } catch (error) {
        console.error('[ImageSearch] Error:', error);
        return [];
    }
}

async function uploadImageFromUrl(
    imageUrl: string,
    productId: string,
    supabaseClient: typeof supabase
): Promise<string | null> {
    try {
        // Fetch the image directly (most CDNs allow CORS for images)
        const response = await fetch(imageUrl, { mode: 'cors' });
        const blob = await response.blob();

        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = imageUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[1] || 'jpg';
        const filename = `${timestamp}-${random}.${extension}`;
        const path = `product_images/${productId}/${filename}`;

        // Upload to Supabase
        const { error } = await supabaseClient.storage
            .from('asset_images')
            .upload(path, blob, {
                contentType: blob.type || 'image/jpeg',
                cacheControl: '31536000',
            });

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('asset_images')
            .getPublicUrl(path);

        return publicUrl;
    } catch (error) {
        console.error('Failed to upload image:', error);
        return null;
    }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProductImageSearchModal({
    open,
    onClose,
    product,
    products = [],
    onImagesAdded,
    mode = 'single',
}: ProductImageSearchModalProps) {
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [images, setImages] = useState<ImageResult[]>([]);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
    const [currentProductIndex, setCurrentProductIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Browse mode: products without images
    const productsWithoutImages = products.filter(
        (p) => !p.image_url && (!p.gallery_images || p.gallery_images.length === 0)
    );

    // Current product
    const currentProduct = mode === 'single'
        ? product
        : productsWithoutImages[currentProductIndex];

    // ============================================================================
    // SEARCH IMAGES
    // ============================================================================

    const searchImages = useCallback(async (query: string) => {
        if (!query.trim()) return;

        setIsSearching(true);
        setError(null);
        setImages([]);

        try {
            const results = await fetchImageResults(query);
            if (results.length > 0) {
                setImages(results);
            } else {
                setError('No images found. Try a different search term.');
            }
        } catch (err) {
            console.error('Image search failed:', err);
            setError('Failed to search images. Please try again.');
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Load more with variation
    const loadMoreImages = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        const modifiers = ['high quality', 'product', 'pack', 'box', 'carton'];
        const randomMod = modifiers[Math.floor(Math.random() * modifiers.length)];

        try {
            const results = await fetchImageResults(`${searchQuery} ${randomMod}`);
            setImages((prev) => {
                const existingUrls = new Set(prev.map((i) => i.url));
                const newImages = results.filter((r) => !existingUrls.has(r.url));
                return [...prev, ...newImages];
            });
        } catch (err) {
            console.error('Load more failed:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // ============================================================================
    // SELECTION
    // ============================================================================

    const toggleImageSelection = (url: string) => {
        setSelectedImages((prev) => {
            if (prev.includes(url)) {
                return prev.filter((u) => u !== url);
            }
            return [...prev, url];
        });
    };

    const clearSelection = () => {
        setSelectedImages([]);
    };

    // ============================================================================
    // SAVE IMAGES
    // ============================================================================

    const saveImages = async () => {
        if (!currentProduct || selectedImages.length === 0) return;

        setIsSaving(true);
        setSavedProducts((prev) => [
            ...prev,
            { productId: currentProduct.id, name: currentProduct.name, status: 'saving', count: selectedImages.length },
        ]);

        try {
            // Upload images directly to Supabase
            const uploadedUrls: string[] = [];

            for (const imageUrl of selectedImages) {
                const uploadedUrl = await uploadImageFromUrl(imageUrl, currentProduct.id, supabase);
                if (uploadedUrl) {
                    uploadedUrls.push(uploadedUrl);
                }
            }

            if (uploadedUrls.length > 0) {
                // Update product in database
                const existingImages = currentProduct.gallery_images || [];
                const newImages = [...existingImages, ...uploadedUrls];

                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        image_url: newImages[0],
                        gallery_images: newImages,
                    })
                    .eq('id', currentProduct.id);

                if (updateError) throw updateError;

                // Update saved status
                setSavedProducts((prev) =>
                    prev.map((p) =>
                        p.productId === currentProduct.id ? { ...p, status: 'done' } : p
                    )
                );

                toast.success(`Added ${uploadedUrls.length} image(s) to ${currentProduct.name}`);

                // Callback
                if (onImagesAdded) {
                    onImagesAdded(currentProduct.id, uploadedUrls);
                }

                // Clear selection and move to next in browse mode
                clearSelection();
                if (mode === 'browse') {
                    goToNextProduct();
                }
            } else {
                throw new Error('No images could be uploaded');
            }
        } catch (err) {
            console.error('Save failed:', err);
            setSavedProducts((prev) =>
                prev.map((p) =>
                    p.productId === currentProduct.id ? { ...p, status: 'error' } : p
                )
            );
            toast.error(`Failed to save images for ${currentProduct.name}`);
        } finally {
            setIsSaving(false);
        }
    };

    // ============================================================================
    // NAVIGATION (Browse mode)
    // ============================================================================

    const goToNextProduct = () => {
        if (currentProductIndex < productsWithoutImages.length - 1) {
            setCurrentProductIndex(currentProductIndex + 1);
            clearSelection();
            setImages([]);
        }
    };

    const goToPrevProduct = () => {
        if (currentProductIndex > 0) {
            setCurrentProductIndex(currentProductIndex - 1);
            clearSelection();
            setImages([]);
        }
    };

    // ============================================================================
    // EFFECTS
    // ============================================================================

    // Initialize search when product changes
    useEffect(() => {
        if (open && currentProduct) {
            const query = currentProduct.brand
                ? `${currentProduct.name} ${currentProduct.brand}`
                : currentProduct.name;
            setSearchQuery(query);
            searchImages(query);
        }
    }, [open, currentProduct?.id]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setSearchQuery('');
            setImages([]);
            setSelectedImages([]);
            setCurrentProductIndex(0);
            setSavedProducts([]);
            setError(null);
        }
    }, [open]);

    // ============================================================================
    // RENDER
    // ============================================================================

    const savingCount = savedProducts.filter((s) => s.status === 'saving').length;
    const savedCount = savedProducts.filter((s) => s.status === 'done').length;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                {/* Header */}
                <DialogHeader className="p-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            {mode === 'browse' ? 'Add Product Images' : 'Search Product Images'}
                        </DialogTitle>
                        <div className="flex items-center gap-3">
                            {savingCount > 0 && (
                                <span className="text-xs text-[var(--color-dark)]/60 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Saving {savingCount}...
                                </span>
                            )}
                            {savedCount > 0 && (
                                <Badge variant="default" className="bg-green-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {savedCount} saved
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex items-center gap-2 mt-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-dark)]/40" />
                            <Input
                                placeholder="Search for product images..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchImages(searchQuery)}
                                className="pl-10"
                            />
                        </div>
                        <Button
                            onClick={() => searchImages(searchQuery)}
                            disabled={isSearching || !searchQuery.trim()}
                        >
                            {isSearching ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Search className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </DialogHeader>

                {/* No product state */}
                {!currentProduct ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                        <ImageIcon className="w-12 h-12 text-[var(--color-coyote)] mb-4" />
                        <h3 className="font-semibold text-lg mb-2">
                            {mode === 'browse' ? 'All Done!' : 'No Product Selected'}
                        </h3>
                        <p className="text-[var(--color-dark)]/60 mb-2">
                            {mode === 'browse'
                                ? 'All products have images.'
                                : 'Select a product to search for images.'}
                        </p>
                        {savedCount > 0 && (
                            <p className="text-sm text-green-600">{savedCount} images saved this session</p>
                        )}
                        <Button onClick={onClose} className="mt-4">Close</Button>
                    </div>
                ) : (
                    <>
                        {/* Product Info Bar */}
                        <div className="px-4 py-3 bg-[var(--color-creme-light)] border-b flex items-center gap-3">
                            {mode === 'browse' && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={goToPrevProduct}
                                    disabled={currentProductIndex === 0}
                                    className="shrink-0"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                            )}

                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-[var(--color-dark)] truncate">
                                    {currentProduct.name}
                                </h3>
                                <p className="text-sm text-[var(--color-dark)]/60">
                                    {currentProduct.brand && `${currentProduct.brand} • `}
                                    {mode === 'browse' && `${currentProductIndex + 1} of ${productsWithoutImages.length}`}
                                </p>
                            </div>

                            {mode === 'browse' && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={goToNextProduct}
                                    disabled={currentProductIndex >= productsWithoutImages.length - 1}
                                    className="shrink-0"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            )}
                        </div>

                        {/* Selection Info */}
                        {selectedImages.length > 0 && (
                            <div className="px-4 py-2 bg-[var(--color-canyon)]/10 border-b flex items-center justify-between">
                                <span className="text-sm font-medium text-[var(--color-canyon)]">
                                    {selectedImages.length} image(s) selected
                                </span>
                                <Button variant="ghost" size="sm" onClick={clearSelection}>
                                    <X className="w-4 h-4 mr-1" />
                                    Clear
                                </Button>
                            </div>
                        )}

                        {/* Image Grid */}
                        <div className="flex-1 overflow-auto p-4">
                            {isSearching && images.length === 0 ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-canyon)]" />
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle className="w-10 h-10 text-[var(--color-coyote)] mb-3" />
                                    <p className="text-[var(--color-dark)]/60">{error}</p>
                                    <Button variant="outline" onClick={loadMoreImages} className="mt-3">
                                        Try Different Search
                                    </Button>
                                </div>
                            ) : images.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Search className="w-10 h-10 text-[var(--color-coyote)] mb-3" />
                                    <p className="text-[var(--color-dark)]/60">
                                        Enter a search term and press Enter
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-4 gap-3">
                                        {images.map((img, idx) => {
                                            const isSelected = selectedImages.includes(img.url);
                                            const selectionIndex = selectedImages.indexOf(img.url);

                                            return (
                                                <button
                                                    key={`${img.url}-${idx}`}
                                                    onClick={() => toggleImageSelection(img.url)}
                                                    className={cn(
                                                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.02] bg-[var(--color-creme-light)]',
                                                        isSelected
                                                            ? 'border-[var(--color-canyon)] ring-2 ring-[var(--color-canyon)]/30 shadow-lg'
                                                            : 'border-transparent hover:border-[var(--color-coyote)]'
                                                    )}
                                                >
                                                    <img
                                                        src={img.thumbnail || img.url}
                                                        alt={img.title || `Option ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.opacity = '0.3';
                                                        }}
                                                    />
                                                    {isSelected && (
                                                        <div className="absolute inset-0 bg-[var(--color-canyon)]/20 flex items-center justify-center">
                                                            <div className="w-8 h-8 rounded-full bg-[var(--color-canyon)] flex items-center justify-center text-white font-bold text-sm">
                                                                {selectionIndex + 1}
                                                            </div>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Load More */}
                                    <div className="flex justify-center mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={loadMoreImages}
                                            disabled={isSearching}
                                        >
                                            {isSearching ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                            )}
                                            Load More Images
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <DialogFooter className="p-4 border-t bg-white">
                            <p className="text-sm text-[var(--color-dark)]/60 mr-auto">
                                Click images to select • First selected = primary image
                            </p>
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={saveImages}
                                disabled={selectedImages.length === 0 || isSaving}
                                className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-white min-w-[120px]"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save ({selectedImages.length})
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default ProductImageSearchModal;
