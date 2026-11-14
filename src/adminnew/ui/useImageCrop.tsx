import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';

// Lets an admin choose how each picked image is clipped before upload.
// The cropper (react-easy-crop) loads on first use, so this hook is cheap to
// import in every upload surface.

/** A number is width / height. 'original' is the picked image's own shape. */
export type CropRatio = number | 'original';

export interface CropPreset {
  label: string;
  ratio: CropRatio;
}

export const DEFAULT_CROP_PRESETS: CropPreset[] = [
  { label: 'Square 1:1', ratio: 1 },
  { label: 'Original', ratio: 'original' },
];

export interface CropResult {
  file: File;
  /** The cropped (and rotated) region, or the untouched file when no crop was made. */
  blob: Blob;
}

export interface ImageCropOptions {
  presets?: CropPreset[];
  defaultRatio?: CropRatio;
  /** Long-edge cap for the cropped output, in px. */
  maxDim?: number;
  title?: string;
}

const ImageCropDialog = lazy(() =>
  import('./ImageCropDialog').then((m) => ({ default: m.ImageCropDialog })),
);

interface Request {
  files: File[];
  index: number;
  results: CropResult[];
  resolve: (results: CropResult[] | null) => void;
}

/**
 * Returns `cropAll(files)`, which opens the cropper for each file in turn and
 * resolves with the results, or null when the admin cancels. Render `dialog`
 * once in the component tree. Pick "Skip cropping for the rest" to upload the
 * remaining files untouched.
 */
export function useImageCrop(options: ImageCropOptions = {}) {
  const {
    presets = DEFAULT_CROP_PRESETS,
    defaultRatio = presets[0]?.ratio ?? 1,
    maxDim = 2400,
    title = 'Crop image',
  } = options;

  const [req, setReq] = useState<Request | null>(null);
  const reqRef = useRef<Request | null>(null);
  // Kept across files in one batch and across batches while mounted.
  const [ratio, setRatio] = useState<CropRatio>(defaultRatio);

  const update = useCallback((next: Request | null) => {
    reqRef.current = next;
    setReq(next);
  }, []);

  const cropAll = useCallback(
    (files: File[]) =>
      new Promise<CropResult[] | null>((resolve) => {
        // A new batch replaces a waiting one (its caller gets null).
        reqRef.current?.resolve(null);
        if (files.length === 0) {
          resolve([]);
          return;
        }
        update({ files, index: 0, results: [], resolve });
      }),
    [update],
  );

  const apply = (blob: Blob, skipRest: boolean) => {
    const current = reqRef.current;
    if (!current) return;
    const results = [...current.results, { file: current.files[current.index], blob }];
    if (skipRest) {
      const rest = current.files.slice(current.index + 1).map((file) => ({ file, blob: file as Blob }));
      current.resolve([...results, ...rest]);
      update(null);
      return;
    }
    if (current.index + 1 >= current.files.length) {
      current.resolve(results);
      update(null);
      return;
    }
    update({ ...current, index: current.index + 1, results });
  };

  const cancel = () => {
    reqRef.current?.resolve(null);
    update(null);
  };

  const dialog: ReactNode = req ? (
    <Suspense fallback={null}>
      <ImageCropDialog
        file={req.files[req.index]}
        position={{ index: req.index, total: req.files.length }}
        presets={presets}
        ratio={ratio}
        onRatioChange={setRatio}
        maxDim={maxDim}
        title={title}
        onApply={apply}
        onCancel={cancel}
      />
    </Suspense>
  ) : null;

  return { cropAll, dialog };
}
