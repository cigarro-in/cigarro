import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrgInfo } from '../org/OrgContext';

export function useOrg() {
  const { slug } = useOrgInfo();
  return useQuery(api.organizations.getBySlug, { slug });
}
