import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from './org';

export function useOrg() {
  return useQuery(api.organizations.getBySlug, { slug: ORG_SLUG });
}
