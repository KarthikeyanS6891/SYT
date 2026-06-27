import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ListingImage } from '@/types';

// ---- mocks ----
vi.mock('@/services/uploadService', () => ({
  uploadApi: { images: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { ImageUploader } from './ImageUploader';
import { uploadApi } from '@/services/uploadService';
import toast from 'react-hot-toast';

const makeFile = (name = 'pic.jpg', type = 'image/jpeg') =>
  new File(['x'], name, { type });

/** Locate the hidden <input type=file>. */
const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImageUploader', () => {
  it('renders the upload prompt with the default max (10)', () => {
    render(<ImageUploader images={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/click to upload images \(max 10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG, WEBP up to 8MB each/i)).toBeInTheDocument();
  });

  it('respects a custom max prop in the prompt text', () => {
    render(<ImageUploader images={[]} onChange={vi.fn()} max={3} />);
    expect(screen.getByText(/click to upload images \(max 3\)/i)).toBeInTheDocument();
  });

  it('exposes a multiple image/* file input that is hidden', () => {
    const { container } = render(<ImageUploader images={[]} onChange={vi.fn()} />);
    const input = fileInput(container);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('multiple');
    expect(input.style.display).toBe('none');
  });

  it('uploads selected files and calls onChange with existing + returned images', async () => {
    const existing: ListingImage[] = [{ url: 'http://x/old.jpg', key: 'old.jpg' }];
    const returned: ListingImage[] = [
      { url: 'http://x/new1.jpg', key: 'new1.jpg' },
      { url: 'http://x/new2.jpg', key: 'new2.jpg' },
    ];
    (uploadApi.images as any).mockResolvedValue({
      data: { images: returned },
      meta: {},
      message: 'OK',
    });
    const onChange = vi.fn();
    const { container } = render(<ImageUploader images={existing} onChange={onChange} />);

    const f1 = makeFile('a.jpg');
    const f2 = makeFile('b.png', 'image/png');
    fireEvent.change(fileInput(container), { target: { files: [f1, f2] } });

    await waitFor(() => expect(uploadApi.images).toHaveBeenCalledTimes(1));
    // called with the actual File[] selected
    const passed = (uploadApi.images as any).mock.calls[0][0];
    expect(passed).toHaveLength(2);
    expect(passed[0]).toBe(f1);
    expect(passed[1]).toBe(f2);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([...existing, ...returned]),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does nothing when no files are selected', () => {
    const onChange = vi.fn();
    const { container } = render(<ImageUploader images={[]} onChange={onChange} />);
    fireEvent.change(fileInput(container), { target: { files: [] } });
    expect(uploadApi.images).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast and does not upload when exceeding the default max (10)', () => {
    const existing: ListingImage[] = Array.from({ length: 9 }, (_, i) => ({
      url: `http://x/${i}.jpg`,
      key: `${i}.jpg`,
    }));
    const onChange = vi.fn();
    const { container } = render(<ImageUploader images={existing} onChange={onChange} />);

    // 9 existing + 2 new = 11 > 10
    fireEvent.change(fileInput(container), {
      target: { files: [makeFile('a.jpg'), makeFile('b.jpg')] },
    });

    expect(toast.error).toHaveBeenCalledWith('Maximum 10 images allowed');
    expect(uploadApi.images).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('honours a custom max when enforcing the limit', () => {
    const existing: ListingImage[] = [{ url: 'http://x/0.jpg', key: '0.jpg' }];
    const onChange = vi.fn();
    const { container } = render(
      <ImageUploader images={existing} onChange={onChange} max={2} />,
    );
    // 1 existing + 2 new = 3 > 2
    fireEvent.change(fileInput(container), {
      target: { files: [makeFile('a.jpg'), makeFile('b.jpg')] },
    });
    expect(toast.error).toHaveBeenCalledWith('Maximum 2 images allowed');
    expect(uploadApi.images).not.toHaveBeenCalled();
  });

  it('allows uploading exactly up to the max (boundary)', async () => {
    const existing: ListingImage[] = [{ url: 'http://x/0.jpg', key: '0.jpg' }];
    (uploadApi.images as any).mockResolvedValue({
      data: { images: [{ url: 'http://x/n.jpg', key: 'n.jpg' }] },
      meta: {},
      message: 'OK',
    });
    const onChange = vi.fn();
    const { container } = render(
      <ImageUploader images={existing} onChange={onChange} max={2} />,
    );
    // 1 existing + 1 new = 2 == max -> allowed
    fireEvent.change(fileInput(container), { target: { files: [makeFile('a.jpg')] } });
    await waitFor(() => expect(uploadApi.images).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('renders existing images as previews with background-image set to their url', () => {
    const existing: ListingImage[] = [
      { url: 'http://x/one.jpg', key: 'one.jpg' },
      { url: 'http://x/two.jpg', key: 'two.jpg' },
    ];
    const { container } = render(
      <ImageUploader images={existing} onChange={vi.fn()} />,
    );
    const items = container.querySelectorAll('.preview-grid .item');
    expect(items).toHaveLength(2);
    expect((items[0] as HTMLElement).style.backgroundImage).toContain('http://x/one.jpg');
    expect((items[1] as HTMLElement).style.backgroundImage).toContain('http://x/two.jpg');

    const removeButtons = screen.getAllByRole('button', { name: /remove image/i });
    expect(removeButtons).toHaveLength(2);
  });

  it('does not render a preview grid when there are no images', () => {
    const { container } = render(<ImageUploader images={[]} onChange={vi.fn()} />);
    expect(container.querySelector('.preview-grid')).not.toBeInTheDocument();
  });

  it('clicking a preview remove button calls onChange without that image', () => {
    const existing: ListingImage[] = [
      { url: 'http://x/one.jpg', key: 'one.jpg' },
      { url: 'http://x/two.jpg', key: 'two.jpg' },
      { url: 'http://x/three.jpg', key: 'three.jpg' },
    ];
    const onChange = vi.fn();
    render(<ImageUploader images={existing} onChange={onChange} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove image/i });
    // remove the middle one (index 1)
    fireEvent.click(removeButtons[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([existing[0], existing[2]]);
  });

  it('shows an error toast when the upload fails and does not call onChange', async () => {
    (uploadApi.images as any).mockRejectedValue(new Error('boom'));
    const onChange = vi.fn();
    const { container } = render(<ImageUploader images={[]} onChange={onChange} />);

    fireEvent.change(fileInput(container), { target: { files: [makeFile('a.jpg')] } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    // errorMessage(err, 'Upload failed') -> uses the Error message when present
    expect(toast.error).toHaveBeenCalledWith('boom');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('falls back to the "Upload failed" message when the error has no message', async () => {
    (uploadApi.images as any).mockRejectedValue({});
    const onChange = vi.fn();
    const { container } = render(<ImageUploader images={[]} onChange={onChange} />);

    fireEvent.change(fileInput(container), { target: { files: [makeFile('a.jpg')] } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Upload failed'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a spinner while uploading and restores the prompt afterwards', async () => {
    let resolveUpload: (v: any) => void = () => {};
    (uploadApi.images as any).mockReturnValue(
      new Promise((res) => {
        resolveUpload = res;
      }),
    );
    const { container } = render(<ImageUploader images={[]} onChange={vi.fn()} />);

    fireEvent.change(fileInput(container), { target: { files: [makeFile('a.jpg')] } });

    await waitFor(() => expect(container.querySelector('.spinner')).toBeInTheDocument());
    expect(screen.queryByText(/click to upload images/i)).not.toBeInTheDocument();

    resolveUpload({ data: { images: [] }, meta: {}, message: 'OK' });

    await waitFor(() =>
      expect(screen.getByText(/click to upload images/i)).toBeInTheDocument(),
    );
    expect(container.querySelector('.spinner')).not.toBeInTheDocument();
  });
});
