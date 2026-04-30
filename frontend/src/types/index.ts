export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  role: 'user' | 'admin';
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  parent?: string | null;
  order?: number;
}

export interface ListingImage {
  url: string;
  key?: string;
}

export type ListingStatus = 'draft' | 'published' | 'sold' | 'disabled';

export interface Listing {
  _id: string;
  seller: User | string;
  title: string;
  description: string;
  category: Category | string;
  price: number;
  currency: string;
  condition: 'new' | 'used' | 'refurbished';
  location: string;
  images: ListingImage[];
  status: ListingStatus;
  boosted: boolean;
  boostExpiresAt?: string;
  views: number;
  isBoostActive?: boolean;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  listing: Listing;
  participants: User[];
  lastMessage?: Message | null;
  lastMessageAt: string;
  unread?: Record<string, number>;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: User;
  body: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Pagination;
}

export interface ListingFilters {
  q?: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'latest' | 'price_asc' | 'price_desc' | 'popular';
  page?: number;
  limit?: number;
  status?: ListingStatus;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
