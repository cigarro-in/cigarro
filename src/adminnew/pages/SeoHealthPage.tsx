import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConvex } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ORG_SLUG } from '../../lib/convex/org';
import { adminPath } from '../lib/paths';
import { Badge, Banner, Button, Card, Page, Skeleton, type BadgeTone } from '../ui';
import { normalizeSeoPath, seoFixPath, SEO_HOW_TO } from './SeoChecks';

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

const getSeoHealthRef = makeFunctionReference<'query', { orgSlug: string }, SeoHealth>('seoHealth:getSeoHealth');

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_TONE: Record<Severity, BadgeTone> = { high: 'critical', medium: 'warning', low: 'neutral' };
const SEVERITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const ITEMS_PREVIEW = 5;

function scoreTone(score: number) {
  if (score >= 85) return { text: 'text-success', stroke: 'stroke-success', label: 'Healthy', tone: 'success' as const };
  if (score >= 60) return { text: 'text-warning', stroke: 'stroke-warning', label: 'Needs work', tone: 'warning' as const };
  return { text: 'text-destructive', stroke: 'stroke-destructive', label: 'At risk', tone: 'critical' as const };
}

function ScoreRing({ score, stroke, text }: { score: number; stroke: string; text: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-border" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={stroke}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-semibold tabular-nums ${text}`}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">of 100</span>
      </div>
    </div>
  );
}

/** One failing check: what is wrong, how to fix it, one Fix button, and the affected items. */
function FailingCheck({ check }: { check: SeoCheck }) {
  const [showAll, setShowAll] = useState(false);
  const fixTo = seoFixPath(check.id, check.items[0]?.adminPath);
  const visible = showAll ? check.items : check.items.slice(0, ITEMS_PREVIEW);
  const hidden = check.items.length - visible.length;

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle
            className={`mt-0.5 size-5 shrink-0 ${check.severity === 'high' ? 'text-destructive' : 'text-warning'}`}
            aria-hidden
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{check.label}</span>
              <Badge tone={SEVERITY_TONE[check.severity]}>{SEVERITY_LABEL[check.severity]}</Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                {check.affected} of {check.total}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{check.description}</p>
            <p className="text-sm text-foreground">
              <span className="font-medium">How to fix: </span>
              {SEO_HOW_TO[check.id] ?? 'Open the affected pages and correct the listed fields.'}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="secondary" className="self-start">
          <Link to={adminPath(fixTo)}>Fix</Link>
        </Button>
      </div>

      {check.items.length > 0 && (
        <div className="ml-8 flex flex-col">
          <ul className="divide-y divide-border rounded-md border border-border">
            {visible.map((item) => (
              <li key={item.id + item.detail} className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
                <Link
                  to={adminPath(normalizeSeoPath(item.adminPath))}
                  className="min-w-0 truncate font-medium text-primary hover:underline sm:max-w-xs"
                >
                  {item.label}
                </Link>
                <span className="min-w-0 text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
          {(hidden > 0 || check.truncated) && (
            <div className="mt-2 flex items-center gap-2">
              {hidden > 0 && (
                <Button size="sm" variant="plain" onClick={() => setShowAll(true)}>
                  Show all {check.items.length}
                </Button>
              )}
              {check.truncated && (
                <span className="text-xs text-muted-foreground">
                  Showing the first {check.items.length} of {check.affected}.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function SeoHealthPage() {
  const convex = useConvex();
  const [data, setData] = useState<SeoHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await convex.query(getSeoHealthRef, { orgSlug: ORG_SLUG });
      setData(res);
      setError(null);
    } catch (err: unknown) {
      const code = (err as { data?: { code?: string } })?.data?.code ?? 'UNKNOWN';
      setError(`Could not load SEO health (${code}). Try again.`);
    } finally {
      setLoading(false);
    }
  }, [convex]);

  useEffect(() => {
    void load();
  }, [load]);

  const failing = useMemo(
    () =>
      data
        ? data.checks
            .filter((c) => c.affected > 0)
            .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.affected - a.affected)
        : [],
    [data],
  );
  const passing = useMemo(() => (data ? data.checks.filter((c) => c.affected === 0) : []), [data]);
  const totalIssues = failing.reduce((sum, c) => sum + c.affected, 0);
  const tone = data ? scoreTone(data.score) : null;

  return (
    <Page
      title="SEO health"
      secondaryActions={[{ label: 'Refresh', onClick: () => void load(), loading }]}
    >
      {error && <Banner tone="critical">{error}</Banner>}

      {!data && loading && (
        <Card>
          <div className="flex flex-col gap-3" role="status" aria-label="Checking the catalog">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </Card>
      )}

      {data && tone && (
        <>
          <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ScoreRing score={data.score} stroke={tone.stroke} text={tone.text} />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">SEO score</h2>
                    <Badge tone={tone.tone}>{tone.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {totalIssues === 0
                      ? 'No issues in the current checks.'
                      : `${totalIssues} ${totalIssues === 1 ? 'issue' : 'issues'} in ${failing.length} ${
                          failing.length === 1 ? 'check' : 'checks'
                        }. Fix them below, starting with the highest severity.`}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Canonical host</dt>
                    <dd className="break-all font-medium">
                      {data.canonicalHost ?? 'No primary domain'}
                      {data.primaryDomainStatus && data.primaryDomainStatus !== 'active' && (
                        <span className="ml-1 text-destructive">({data.primaryDomainStatus})</span>
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
                      {data.counts.products} products · {data.counts.categories} categories · {data.counts.blogPosts} posts
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
            </div>
          </Card>

          {failing.length > 0 && (
            <Card title={`Needs attention · ${failing.length}`} padding="none">
              <ul className="divide-y divide-border">
                {failing.map((check) => (
                  <FailingCheck key={check.id} check={check} />
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Passing · ${passing.length}`} padding="none">
            {passing.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No check passes yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {passing.map((check) => (
                  <li key={check.id} className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{check.label}</span>
                    <span className="text-xs text-muted-foreground">Passing</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="px-1 text-xs text-muted-foreground">
            Static pages (about, contact, terms) are defined in code and are not scanned. Search Console data is not read here.
          </p>
        </>
      )}
    </Page>
  );
}
