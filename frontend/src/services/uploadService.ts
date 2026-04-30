import api, { unwrap } from './api';
import type { ListingImage } from '@/types';

export const uploadApi = {
  images: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return unwrap(
      api.post<{ data: { images: ListingImage[] }; meta: any; message: string }>(
        '/uploads/images',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
    );
  },
};
