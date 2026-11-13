import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConvex } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { InlineStatus, useInlineStatus } from '../../components/common/InlineStatus';
import { ORG_SLUG } from '../../lib/convex/org';
import { PageHeader } from '../components/shared/PageHeader';
import { adminPath } from '../lib/paths';

type Severity = 'high' | 'medium' | 'low';

interface SeoItem {
  id: string;
  kind: string;
  label: string;
  detail: string;
  adminPath: string;
}

interface SeoCheck {
  id: string;
  label: string;
  description: string;
  severity: Severity;
  weight: number;
  total: number;
  affected: number;
  items: SeoItem[];
  truncated: boolean;
}

interface SeoHealth {
  orgSlug: string;
  generatedAt: number;
  score: number;
  canonicalHost: string | null;
  primaryDomainStatus: string | null;
  counts: { products: number; categories: number; blogPosts: number; redirects: number; domains: number };
  sitemap: { enabled: boolean; path: string; urls: number };
  checks: SeoCheck[];
}

const getSeoHealthRef = makeFunctionReference<'query', { orgSlug: string }, SeoHealth>(
  'seoHealth:getSeoHealth',
);

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function scoreTone(score: number) {
  if (score >= 85) return { text: 'text-emerald-600', stroke: 'stroke-emerald-500', label: 'Healthy' };
  if (score >= 60) return { text: 'text-amber-600', stroke: 'stroke-amber-500', label: 'Needs work' };
  return { text: 'text-red-600', stroke: 'stroke-red-500', label: 'At risk' };
}

function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const tone = scoreTone(score);
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={tone.stroke}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-semibold tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-[11px] text-muted-foreground">of 100</span>
      </div>
    </div>
  );
}

function CheckCard({
  check,
  open,
  onToggle,
}: {
  check: SeoCheck;
  open: boolean;
  onToggle: () => void;
}) {
  const passing = check.affected === 0;
  const panelId = `seo-check-${check.id}`;
  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 rounded-xl p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {passing ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <AlertTriangle
            className={`mt-0.5 h-5 w-5 shrink-0 ${check.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{check.label}</span>
            <Badge variant="outline" className="text-[11px]">
              {SEVERITY_LABEL[check.severity]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{check.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">
            {check.affected} <span className="font-normal text-muted-foreground">/ {check.total}</span>
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>

      {open && (
        <div id={panelId} className="border-t px-4 py-3">
          {check.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to fix here.</p>
          ) : (
            <ul className="divide-y">
              {check.items.map((item) => (
                <li key={item.id + item.detail} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <Link
                    to={adminPath(item.adminPath)}
                    className="min-w-0 truncate font-medium text-primary underline-offset-2 hover:underline sm:max-w-[40%]"
                  >
                    {item.label}
                  </Link>
                  <span className="text-sm text-muted-foreground">{item.detail}</span>
                </li>
              ))}
            </ul>
          )}
          {check.truncated && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the first {check.items.length} of {check.affected}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function SeoHealthPage() {
  const convex = useConvex();
  const [data, setData] = useState<SeoHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const { status, setError, clear } = useInlineStatus();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await convex.query(getSeoHealthRef, { orgSlug: ORG_SLUG });
      setData(res);
      clear();
    } catch (err: any) {
      const code = err?.data?.code ?? 'UNKNOWN';
      setError(`Could not load SEO health (${code}). Try again.`);
    } finally {
      setLoading(false);
    }
  }, [convex, clear, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedChecks = useMemo(() => {
    if (!data) return [];
    return [...data.checks].sort((a, b) => {
      const failing = Number(b.affected > 0) - Number(a.affected > 0);
      if (failing !== 0) return failing;
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      return b.affected - a.affected;
    });
  }, [data]);

  const totalIssues = useMemo(
    () => (data ? data.checks.reduce((sum, c) => sum + c.affected, 0) : 0),
    [data],
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tone = data ? scoreTone(data.score) : null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="SEO health"
        description="Live checks on this store's products, categories, posts, redirects and domain"
      >
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </PageHeader>

      <div className="mx-auto flex max-w-400 flex-col gap-4 px-4 py-4 sm:px-6">
        <InlineStatus status={status} />

        {loading && !data && (
          <p className="text-sm text-muted-foreground" role="status">
            Checking the catalog...
          </p>
        )}

        {data && tone && (
          <>
            <Card>
              <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <ScoreRing score={data.score} />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">Overall score</h2>
                      <Badge variant="outline" className={tone.text}>
                        {tone.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {totalIssues === 0
                        ? 'No issues found in the current checks.'
                        : `${totalIssues} issue${totalIssues === 1 ? '' : 's'} across ${
                            data.checks.filter((c) => c.affected > 0).length
                          } checks. Open a check to see the items.`}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Canonical host</dt>
                      <dd className="font-medium break-all">
                        {data.canonicalHost ?? 'No primary domain'}
                        {data.primaryDomainStatus && data.primaryDomainStatus !== 'active' && (
                          <span className="ml-1 text-red-600">({data.primaryDomainStatus})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Sitemap</dt>
                      <dd className="font-medium">
                        {data.sitemap.enabled ? `On at ${data.sitemap.path}` : 'Off'}
                        <span className="text-muted-foreground"> · {data.sitemap.urls} URLs</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Scanned</dt>
                      <dd className="font-medium">
                        {data.counts.products} products · {data.counts.categories} categories · {data.counts.blogPosts}{' '}
                        posts
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Redirects</dt>
                      <dd className="font-medium">{data.counts.redirects}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Domains</dt>
                      <dd className="font-medium">{data.counts.domains}</dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sortedChecks.map((check) => (
                <CheckCard
                  key={check.id}
                  check={check}
                  open={openIds.has(check.id)}
                  onToggle={() => toggle(check.id)}
                />
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">What is not checked here</CardTitle>
                <CardDescription>
                  Static pages (about, contact, terms) are defined in code, not stored rows, so they are not
                  scanned. Search Console data (rankings, indexing) is not read by this page.
                </CardDescription>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
