import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { favoriteApi } from '@/services/favoriteService';
import { errorMessage } from '@/services/api';
import { Loader } from '@/components/common/Loader';
import { ListingGrid } from '@/components/listings/ListingGrid';
import type { Listing } from '@/types';

export default function Favorites() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    favoriteApi
      .list({ limit: 50 })
      .then(({ data }) => setItems(data.items))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const onToggle = async (id: string, next: boolean) => {
    try {
      if (!next) {
        await favoriteApi.remove(id);
        setItems((prev) => prev.filter((l) => l._id !== id));
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <h1 className="title">Favorites</h1>
      {loading ? (
        <Loader />
      ) : (
        <ListingGrid
          items={items}
          onToggleFavorite={onToggle}
          emptyText="You haven't saved any listings yet."
        />
      )}
    </>
  );
}
