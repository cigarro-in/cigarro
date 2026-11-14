import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useOrgInfo } from '../../lib/org/OrgContext';
import { invalidateStorefront } from '../../lib/cache/invalidateStorefront';
import { useTheme } from '../../themes';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  Page,
  PageLayout,
  Skeleton,
  Switch,
  Textarea,
  toActionError,
  useButtonFeedback,
  type ActionError,
} from '../ui';
import { ImageField } from '../features/homepage/ImageField';
import { LinkPicker } from '../features/homepage/LinkPicker';
import { HERO_PRODUCT_SPEC, heroBannerSpec, heroPhoneSpec } from '../features/homepage/imageSpecs';

interface SlideForm {
  title: string;
  suptitle: string;
  description: string;
  imageUrl: string;
  mobileImageUrl: string;
  buttonText: string;
  buttonUrl: string;
  productName: string;
  productPrice: string;
  productImageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY: SlideForm = {
  title: '',
  suptitle: '',
  description: '',
  imageUrl: '',
  mobileImageUrl: '',
  buttonText: '',
  buttonUrl: '',
  productName: '',
  productPrice: '',
  productImageUrl: '',
  isActive: true,
  sortOrder: 0,
};

// Hero slide editor. Fields follow the active theme: Classic reads the
// description and the product card; Vivid does not, so those are hidden there.
export function HeroSlideFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id && id !== 'new');
  const { slug } = useOrgInfo();
  const { themeId } = useTheme();
  const isClassic = themeId !== 'vivid';

  const slides = useQuery(api.adminCatalog.listHeroSlidesForAdmin, { orgSlug: slug });
  const saveSlide = useMutation(api.adminCatalog.saveHeroSlide);
  const removeSlide = useMutation(api.adminCatalog.deleteHeroSlide);

  const [form, setForm] = useState<SlideForm | null>(null);
  const [formError, setFormError] = useState<ActionError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useButtonFeedback();
  const remove = useButtonFeedback();

  const existing = isEdit ? slides?.find((s) => s._id === id) : undefined;
  const missing = isEdit && slides !== undefined && !existing;

  // Fill the form once: from the stored slide, or with the next sort slot.
  useEffect(() => {
    if (form || slides === undefined) return;
    if (isEdit) {
      if (!existing) return;
      setForm({
        title: existing.title ?? '',
        suptitle: existing.suptitle ?? '',
        description: existing.description ?? '',
        imageUrl: existing.imageUrl ?? '',
        mobileImageUrl: existing.mobileImageUrl ?? '',
        buttonText: existing.buttonText ?? '',
        buttonUrl: existing.buttonUrl ?? '',
        productName: existing.productName ?? '',
        productPrice: existing.productPrice != null ? String(existing.productPrice) : '',
        productImageUrl: existing.productImageUrl ?? '',
        isActive: existing.isActive,
        sortOrder: existing.sortOrder,
      });
    } else {
      const next = Math.max(-1, ...slides.map((s) => s.sortOrder)) + 1;
      setForm({ ...EMPTY, sortOrder: next });
    }
  }, [slides, form, isEdit, existing]);

  const set = <K extends keyof SlideForm>(key: K, value: SlideForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const onSave = async () => {
    if (!form) return;
    if (!form.title.trim()) return setFormError({ message: 'Add a headline before saving.' });
    if (!form.imageUrl) return setFormError({ message: 'Choose a banner image before saving.' });
    const price = form.productPrice.trim() ? Number(form.productPrice) : undefined;
    if (price !== undefined && !Number.isFinite(price)) {
      return setFormError({ message: 'The product price must be a number.' });
    }
    setFormError(null);

    // Empty text is sent as "" so a cleared field really clears on the server.
    const result = await save.run(() =>
      saveSlide({
        orgSlug: slug,
        id: isEdit ? (id as Id<'heroSlides'>) : undefined,
        slide: {
          title: form.title.trim(),
          suptitle: form.suptitle.trim(),
          description: isClassic ? form.description.trim() : undefined,
          imageUrl: form.imageUrl,
          mobileImageUrl: form.mobileImageUrl,
          buttonText: form.buttonText.trim(),
          buttonUrl: form.buttonUrl.trim(),
          productName: isClassic ? form.productName.trim() : undefined,
          productPrice: isClassic ? price : undefined,
          productImageUrl: isClassic ? form.productImageUrl : undefined,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        },
      }),
    );
    if (result) {
      void invalidateStorefront();
      navigate('/homepage');
    }
  };

  const onDelete = async () => {
    if (!isEdit || !id) return;
    const result = await remove.run(() => removeSlide({ orgSlug: slug, id: id as Id<'heroSlides'> }));
    if (result) {
      setConfirmDelete(false);
      void invalidateStorefront();
      navigate('/homepage');
    }
  };

  if (missing) {
    return (
      <Page title="Hero slide" backTo="/homepage">
        <EmptyState
          title="This slide no longer exists"
          description="It may have been deleted. Go back to the homepage to pick another slide."
        />
      </Page>
    );
  }

  if (!form) {
    return (
      <Page title={isEdit ? 'Edit slide' : 'New slide'} backTo="/homepage">
        <Skeleton className="h-96 w-full" />
      </Page>
    );
  }

  return (
    <Page
      title={isEdit ? form.title || 'Edit slide' : 'New slide'}
      backTo="/homepage"
      primaryAction={{
        label: isEdit ? 'Save slide' : 'Add slide',
        onClick: () => void onSave(),
        state: save.state,
      }}
      secondaryActions={
        isEdit ? [{ label: 'Delete slide', critical: true, onClick: () => setConfirmDelete(true) }] : []
      }
    >
      <ErrorBanner error={formError ?? save.error ?? remove.error} onDismiss={() => setFormError(null)} />

      <PageLayout
        main={
          <div className="space-y-3">
            <Card title="Image">
              <div className="space-y-5">
                <ImageField
                  label="Banner image"
                  value={form.imageUrl}
                  onChange={(url) => set('imageUrl', url)}
                  uploadSlug={form.title}
                  spec={heroBannerSpec(themeId)}
                  note={isClassic ? 'Shown on desktop and tablet. Phones use the phone image when one is set.' : 'Shown on desktop and tablet (768px and up).'}
                />
                <ImageField
                  label="Phone image (optional)"
                  value={form.mobileImageUrl}
                  onChange={(url) => set('mobileImageUrl', url)}
                  uploadSlug={form.title}
                  spec={heroPhoneSpec(themeId)}
                  note={
                    isClassic
                      ? 'Used on phones. Leave empty to use the banner image.'
                      : 'Used on phones (below 768px). Leave empty to use the banner image.'
                  }
                />
              </div>
            </Card>

            <Card title="Text">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slide-suptitle">Small text above the headline (optional)</Label>
                  <Input id="slide-suptitle" value={form.suptitle} onChange={(e) => set('suptitle', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slide-title">Headline</Label>
                  <Input id="slide-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
                </div>
                {isClassic && (
                  <div className="space-y-2">
                    <Label htmlFor="slide-description">Supporting text (optional)</Label>
                    <Textarea
                      id="slide-description"
                      rows={3}
                      value={form.description}
                      onChange={(e) => set('description', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card title="Button">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slide-button-text">Button text (optional)</Label>
                  <Input
                    id="slide-button-text"
                    value={form.buttonText}
                    onChange={(e) => set('buttonText', e.target.value)}
                    placeholder="Shop now"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Where the button goes</Label>
                  {/* Mounted only after the stored link is loaded, so its initial kind is right. */}
                  <LinkPicker key={isEdit ? `edit-${existing?._id}` : 'new'} value={form.buttonUrl} onChange={(url) => set('buttonUrl', url)} />
                </div>
              </div>
            </Card>
          </div>
        }
        aside={
          <div className="space-y-3">
            <Card title="Show on store">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{form.isActive ? 'Shown' : 'Hidden'}</span>
                <Switch
                  aria-label="Show this slide"
                  checked={form.isActive}
                  onCheckedChange={(v) => set('isActive', v)}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Slides show in the order set on the Homepage page.
              </p>
            </Card>
            {isClassic && (
              <Card title="Product card (optional)">
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">A small product shown beside the banner.</p>
                  <div className="space-y-2">
                    <Label htmlFor="slide-product-name">Product name</Label>
                    <Input id="slide-product-name" value={form.productName} onChange={(e) => set('productName', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slide-product-price">Price (rupees)</Label>
                    <Input
                      id="slide-product-price"
                      inputMode="decimal"
                      value={form.productPrice}
                      onChange={(e) => set('productPrice', e.target.value)}
                    />
                  </div>
                  <ImageField
                    label="Product image"
                    value={form.productImageUrl}
                    onChange={(url) => set('productImageUrl', url)}
                    uploadSlug={form.productName || form.title}
                    spec={HERO_PRODUCT_SPEC}
                  />
                </div>
              </Card>
            )}
          </div>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
        title="Delete this slide?"
        description="It is removed from the homepage. This cannot be undone."
        confirmLabel="Delete slide"
        critical
        onConfirm={onDelete}
      />
    </Page>
  );
}
