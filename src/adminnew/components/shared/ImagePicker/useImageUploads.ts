import { useCallback, useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from 'react';
import { fetchRemoteBytes, humanizeAlt, uploadImageToR2, type R2Image } from '../../../../lib/images/upload';
import { toActionError, useImageCrop } from '../../../ui';
import { aspectConfig, type ImageAspect } from './aspect';
import { addToLibrary, libraryImageFromUpload } from './useImageLibrary';

export type UploadStage = 'queued' | 'fetching' | 'converting' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;
  name: string;
  /** Local preview (object URL) or the web thumbnail. */
  preview: string;
  stage: UploadStage;
  error?: string;
  image?: R2Image;
  /** Web result this item came from. */
  sourceUrl?: string;
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const ACCEPT_ATTR = ACCEPT.join(',');
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const CONCURRENCY = 2;

export const STAGE_LABEL: Record<UploadStage, string> = {
  queued: 'Waiting',
  fetching: 'Downloading',
  converting: 'Optimising',
  uploading: 'Saving',
  done: 'Added',
  error: 'Failed',
};

function rejectReason(file: File): string | null {
  if (!ACCEPT.includes(file.type)) return 'Use a JPG, PNG, WebP, GIF or AVIF image.';
  if (file.size > MAX_INPUT_BYTES) return 'This file is over 15 MB.';
  return null;
}

let seq = 0;
const nextId = () => `up-${Date.now()}-${++seq}`;

/**
 * The one image pipeline every picker path ends in: (crop) → WebP → R2 with an
 * SEO filename → added to the shared library. Upload and web import both use it.
 * Render `cropDialog` once.
 */
export function useImageUploads({
  aspect,
  slug,
  onUploaded,
}: {
  aspect: ImageAspect;
  /** SEO filename stem and alt text (the product or page name). */
  slug?: string;
  onUploaded?: (image: R2Image, item: UploadItem) => void;
}) {
  const cfg = aspectConfig(aspect);
  const crop = useImageCrop({ presets: cfg.cropPresets, defaultRatio: cfg.defaultRatio, maxDim: cfg.maxDim, title: 'Frame your image' });
  const [items, setItems] = useState<UploadItem[]>([]);
  const previews = useRef<string[]>([]);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = useCallback((id: string, p: Partial<UploadItem>) => {
    setItems((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));
  }, []);

  const send = useCallback(
    async (item: UploadItem, blob: Blob, fileName: string) => {
      try {
        const res = await uploadImageToR2(blob, {
          slug: slug || fileName,
          filename: fileName,
          alt: slug ? humanizeAlt(slug) : undefined,
          keepOriginalResolution: !cfg.square,
          maxDim: cfg.maxDim,
          onStage: (stage) => patch(item.id, { stage }),
        });
        const image = libraryImageFromUpload(res);
        addToLibrary(image);
        patch(item.id, { stage: 'done', image });
        onUploadedRef.current?.(image, { ...item, stage: 'done', image });
        return image;
      } catch (err) {
        patch(item.id, { stage: 'error', error: toActionError(err, 'Could not save this image. Try again.').message });
        return null;
      }
    },
    [slug, cfg.square, cfg.maxDim, patch],
  );

  /** Upload local files (drop, paste, browse). Resolves with the stored images, in order. */
  const addFiles = useCallback(
    async (files: File[]): Promise<R2Image[]> => {
      if (files.length === 0) return [];
      const rejected: UploadItem[] = [];
      const valid: File[] = [];
      for (const f of files) {
        const reason = rejectReason(f);
        if (reason) rejected.push({ id: nextId(), name: f.name || 'Pasted image', preview: '', stage: 'error', error: reason });
        else valid.push(f);
      }
      if (rejected.length) setItems((prev) => [...rejected, ...prev]);
      if (!valid.length) return [];
      const framed = cfg.crop ? await crop.cropAll(valid) : valid.map((file) => ({ file, blob: file as Blob }));
      if (!framed?.length) return [];
      const batch = framed.map(({ file, blob }) => {
        const preview = URL.createObjectURL(blob);
        previews.current.push(preview);
        return { item: { id: nextId(), name: file.name || 'Pasted image', preview, stage: 'queued' as UploadStage }, blob, file };
      });
      setItems((prev) => [...batch.map((b) => b.item), ...prev]);
      const out: (R2Image | null)[] = new Array(batch.length).fill(null);
      let next = 0;
      const worker = async () => {
        while (next < batch.length) {
          const i = next++;
          out[i] = await send(batch[i].item, batch[i].blob, batch[i].file.name || 'image');
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));
      return out.filter((x): x is R2Image => !!x);
    },
    [cfg.crop, crop, send],
  );

  /** Import one web result through the admin fetch proxy, then the same pipeline. */
  const importUrl = useCallback(
    async (url: string, opts: { thumbnail?: string; title?: string } = {}): Promise<R2Image | null> => {
      const item: UploadItem = { id: nextId(), name: opts.title || url.split('/').pop() || 'Web image', preview: opts.thumbnail || url, stage: 'fetching', sourceUrl: url };
      setItems((prev) => [item, ...prev.filter((p) => p.sourceUrl !== url)]);
      let bytes: Blob;
      try {
        bytes = await fetchRemoteBytes(url);
      } catch (err) {
        // Some sites refuse the full image; the search thumbnail is a fair fallback.
        if (!opts.thumbnail || opts.thumbnail === url) {
          patch(item.id, { stage: 'error', error: toActionError(err, 'This site would not share the image. Pick another.').message });
          return null;
        }
        try {
          bytes = await fetchRemoteBytes(opts.thumbnail);
        } catch {
          patch(item.id, { stage: 'error', error: 'This site would not share the image. Pick another.' });
          return null;
        }
      }
      const name = (url.split('/').pop()?.split('?')[0] || 'web-image').slice(0, 80);
      const file = new File([bytes], name, { type: bytes.type });
      let blob: Blob = file;
      if (cfg.crop) {
        const framed = await crop.cropAll([file]);
        if (!framed?.length) {
          setItems((prev) => prev.filter((p) => p.id !== item.id));
          return null;
        }
        blob = framed[0].blob;
      }
      return send(item, blob, name);
    },
    [cfg.crop, crop, send, patch],
  );

  const dismiss = useCallback((id: string) => setItems((prev) => prev.filter((u) => u.id !== id)), []);
  const clearFinished = useCallback(() => setItems((prev) => prev.filter((u) => u.stage !== 'done' && u.stage !== 'error')), []);
  const busy = items.some((u) => u.stage !== 'done' && u.stage !== 'error');

  return { items, addFiles, importUrl, dismiss, clearFinished, busy, cropDialog: crop.dialog };
}

/** Image files from a paste event (screenshots, copied images). */
export function filesFromClipboard(e: ClipboardEvent | ReactClipboardEvent): File[] {
  const data = e.clipboardData;
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== 'file') continue;
    const f = item.getAsFile();
    if (f && f.type.startsWith('image/')) {
      files.push(f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${Date.now()}.${f.type.split('/')[1] || 'png'}`, { type: f.type }));
    }
  }
  return files;
}

/** An image link pasted as text, if any. */
export function urlFromClipboard(e: ClipboardEvent | ReactClipboardEvent): string | null {
  const text = e.clipboardData?.getData('text/plain')?.trim() ?? '';
  return /^https?:\/\/\S+$/i.test(text) ? text : null;
}
