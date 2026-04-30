import { FC, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { uploadApi } from '@/services/uploadService';
import { errorMessage } from '@/services/api';
import type { ListingImage } from '@/types';

interface Props {
  images: ListingImage[];
  onChange: (next: ListingImage[]) => void;
  max?: number;
}

export const ImageUploader: FC<Props> = ({ images, onChange, max = 10 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = () => inputRef.current?.click();

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > max) {
      toast.error(`Maximum ${max} images allowed`);
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const { data } = await uploadApi.images(files);
      onChange([...images, ...data.images]);
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="uploader" onClick={onPick}>
        {uploading ? <span className="spinner" /> : (
          <>
            <div style={{ fontSize: 24 }}>📷</div>
            <div>Click to upload images (max {max})</div>
            <div className="text-xs muted">JPG, PNG, WEBP up to 8MB each</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={onFiles}
        />
      </div>

      {images.length > 0 && (
        <div className="preview-grid">
          {images.map((img, i) => (
            <div key={i} className="item" style={{ backgroundImage: `url(${img.url})` }}>
              <button type="button" onClick={() => remove(i)} aria-label="Remove image">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
