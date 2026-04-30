import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listingApi, categoryApi } from '@/services/listingService';
import { errorMessage } from '@/services/api';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Loader } from '@/components/common/Loader';
import { ImageUploader } from '@/components/listings/ImageUploader';
import type { Category, Listing, ListingImage } from '@/types';

interface FormData {
  title: string;
  description: string;
  category: string;
  price: number;
  condition: 'new' | 'used' | 'refurbished';
  location: string;
  status: 'draft' | 'published';
}

export default function PostAd() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: { condition: 'used', status: 'published' },
  });

  useEffect(() => {
    categoryApi.list().then(({ data }) => setCategories(data.items)).catch(() => null);
  }, []);

  useEffect(() => {
    if (!id) return;
    listingApi
      .get(id)
      .then(({ data }) => {
        const l: Listing = data.listing;
        reset({
          title: l.title,
          description: l.description,
          category: typeof l.category === 'string' ? l.category : l.category._id,
          price: l.price,
          condition: l.condition,
          location: l.location,
          status: l.status === 'sold' || l.status === 'disabled' ? 'published' : (l.status as any),
        });
        setImages(l.images);
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        navigate('/my-listings');
      })
      .finally(() => setLoading(false));
  }, [id, reset, navigate]);

  const onSubmit = async (data: FormData) => {
    if (images.length === 0) {
      toast.error('Add at least one image');
      return;
    }
    try {
      const payload = { ...data, price: Number(data.price), images };
      if (isEdit && id) {
        await listingApi.update(id, payload as any);
        toast.success('Listing updated');
      } else {
        await listingApi.create(payload as any);
        toast.success('Listing created');
      }
      navigate('/my-listings');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <Loader />;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 className="title">{isEdit ? 'Edit listing' : 'Post a new ad'}</h1>
      <form className="card" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Title"
          placeholder="What are you selling?"
          error={errors.title?.message}
          {...register('title', { required: 'Title required', minLength: 3, maxLength: 140 })}
        />
        <Textarea
          label="Description"
          rows={5}
          placeholder="Add details about condition, age, accessories..."
          error={errors.description?.message}
          {...register('description', { required: 'Description required', minLength: 10 })}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select
            label="Category"
            placeholder="Select category"
            options={categories.map((c) => ({ value: c._id, label: `${c.icon || ''} ${c.name}` }))}
            error={errors.category?.message}
            {...register('category', { required: 'Category required' })}
          />
          <Input
            label="Price"
            type="number"
            min={0}
            error={errors.price?.message}
            {...register('price', { required: 'Price required', valueAsNumber: true, min: 0 })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select
            label="Condition"
            options={[
              { value: 'new', label: 'New' },
              { value: 'used', label: 'Used' },
              { value: 'refurbished', label: 'Refurbished' },
            ]}
            {...register('condition')}
          />
          <Input
            label="Location"
            error={errors.location?.message}
            {...register('location', { required: 'Location required' })}
          />
        </div>

        <Select
          label="Status"
          options={[
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Draft' },
          ]}
          {...register('status')}
        />

        <div className="field">
          <label>Images</label>
          <ImageUploader images={images} onChange={setImages} />
        </div>

        <div className="row" style={{ gap: 8 }}>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Publish ad'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
