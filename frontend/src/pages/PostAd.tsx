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
import { LocationPicker } from '@/components/map/LocationPicker';
import type { LatLng } from '@/components/map/leaflet';
import type { Category, Listing, ListingImage, ListingStatus } from '@/types';

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
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [originalStatus, setOriginalStatus] = useState<ListingStatus | null>(null);
  const statusLocked = isEdit && (originalStatus === 'sold' || originalStatus === 'disabled');
  const {
    register, handleSubmit, reset, getValues, setValue, formState: { errors, isSubmitting },
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
          // The status <select> only offers draft/published; sold/disabled listings
          // are shown here for display purposes only and are excluded from the
          // submitted payload below (see statusLocked) so saving never silently
          // republishes a sold/disabled listing.
          status: l.status === 'sold' || l.status === 'disabled' ? 'published' : (l.status as any),
        });
        setOriginalStatus(l.status);
        setImages(l.images);
        setCoords(
          l.geo?.coordinates
            ? { lat: l.geo.coordinates[1], lng: l.geo.coordinates[0] }
            : null
        );
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
      const payload: Partial<FormData> & Record<string, unknown> = {
        ...data,
        price: Number(data.price),
        images,
        // On edit, explicit nulls clear a previously saved pin.
        latitude: coords?.lat ?? (isEdit ? null : undefined),
        longitude: coords?.lng ?? (isEdit ? null : undefined),
      };
      // Sold/disabled listings don't expose a real status option in the form
      // (see statusLocked); never send the coerced 'published' placeholder back.
      if (statusLocked) delete payload.status;
      if (isEdit && id) {
        await listingApi.update(id, payload);
        toast.success('Listing updated');
      } else {
        await listingApi.create(payload);
        toast.success('Listing created');
      }
      navigate('/my-listings');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="page-narrow">
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

        <div className="form-grid-2">
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

        <div className="form-grid-2">
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

        <div className="field">
          <label>Pin on map (optional)</label>
          <LocationPicker
            value={coords}
            onChange={setCoords}
            autoLocate={!isEdit}
            onAddressFound={(address) => {
              if (!getValues('location')) {
                setValue('location', address, { shouldValidate: true });
              }
            }}
          />
        </div>

        <Select
          label="Status"
          disabled={statusLocked}
          hint={statusLocked ? `This listing is ${originalStatus} and can't be changed here.` : undefined}
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
