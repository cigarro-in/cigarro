import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';

// Theme-safe reviews surface (Wave 10, Convex-native). Themes must not
// import convex/react directly — use these hooks.

export interface ProductReview {
  _id: string;
  productSupabaseId: string;
  userName: string;
  rating: number;
  title?: string;
  comment?: string;
  createdAt: number;
}

export function useProductReviews(productSupabaseId: string | undefined) {
  const data = useQuery(
    api.reviews.listProductReviews,
    productSupabaseId ? { productSupabaseId, limit: 20, orgSlug: ORG_SLUG } : 'skip'
  );
  const submit = useMutation(api.reviews.submitReview);
  return {
    reviews: (data?.reviews || []) as ProductReview[],
    count: data?.count ?? 0,
    average: data?.average ?? 0,
    loading: data === undefined,
    submitReview: (args: {
      rating: number;
      title?: string;
      comment?: string;
      userName?: string;
    }) => submit({ productSupabaseId: productSupabaseId!, orgSlug: ORG_SLUG, ...args }),
  };
}

export function useMyReviews() {
  const data = useQuery(api.reviews.listMyReviews, { orgSlug: ORG_SLUG });
  return {
    reviews: (data || []) as (ProductReview & {
      isApproved: boolean;
      product: { name: string; slug: string };
    })[],
    loading: data === undefined,
  };
}
