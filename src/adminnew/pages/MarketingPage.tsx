import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOrg } from '../../lib/convex/useOrg';
import { ORG_SLUG } from '../../lib/convex/org';
import { PageHeader } from '../components/shared/PageHeader';
import { DataTable } from '../components/shared/DataTable';
import { AdminCard, AdminCardContent, AdminCardHeader, AdminCardTitle } from '../components/shared/AdminCard';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { MessageCircle, Upload, Send, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// wa.me digits for Indian mobiles. Mirrors convex/marketing:normalizePhone.
function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  let d = digits;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  return null;
}

interface RenderContact {
  name?: string;
  city?: string;
  phone?: string;
}

// {{name}} {{firstname}} {{city}} {{phone}} {{code}} {{link}}
function renderMessage(template: string, c: RenderContact, extras?: { code?: string; link?: string }) {
  const name = c.name && c.name !== '—' ? c.name : '';
  const first = name.trim().split(/\s+/)[0] ?? '';
  return template
    .replace(/\{\{\s*firstname\s*\}\}/gi, first)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*city\s*\}\}/gi, c.city && c.city !== '—' ? c.city : '')
    .replace(/\{\{\s*phone\s*\}\}/gi, c.phone ?? '')
    .replace(/\{\{\s*code\s*\}\}/gi, extras?.code ?? '')
    .replace(/\{\{\s*link\s*\}\}/gi, extras?.link ?? '');
}

// convex.site base for the tracked /m redirect (VITE_CONVEX_URL is .convex.cloud).
function trackBase() {
  const apiUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (apiUrl?.includes('.convex.cloud')) return apiUrl.replace('.convex.cloud', '.convex.site');
  return 'https://proper-coyote-383.convex.site';
}

function trackLink(campaignId: string, contactId: string) {
  return `${trackBase()}/m?c=${campaignId}&p=${contactId}`;
}

function waLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

const VARIABLES = [
  { tag: '{{firstname}}', label: 'First name' },
  { tag: '{{city}}', label: 'City' },
  { tag: '{{code}}', label: 'Coupon' },
  { tag: '{{link}}', label: 'Shop link' },
  { tag: '{{phone}}', label: 'Phone' },
] as const;

interface ParsedContact {
  phone: string;
  name?: string;
  city?: string;
  email?: string;
  totalOrders?: number;
  totalSalesPaise?: number;
}

function parseWorkbook(file: File): Promise<{ contacts: ParsedContact[]; skipped: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const headerIdx = rows.findIndex((r) =>
          r.some((c) => typeof c === 'string' && /mobile|phone/i.test(c)),
        );
        if (headerIdx === -1) throw new Error('No Mobile/Phone column found');
        const header = rows[headerIdx].map((c) => String(c ?? '').toLowerCase());
        const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
        const iPhone = col(['mobile', 'phone']);
        const iName = col(['customer name', 'name']);
        const iCity = col(['city']);
        const iEmail = col(['email']);
        const iOrders = col(['total orders']);
        const iSales = col(['total sales']);
        const seen = new Set<string>();
        const contacts: ParsedContact[] = [];
        let skipped = 0;
        for (const r of rows.slice(headerIdx + 1)) {
          const phone = normalizePhone(r[iPhone]);
          if (!phone || seen.has(phone)) {
            skipped++;
            continue;
          }
          seen.add(phone);
          const salesRaw = String(r[iSales] ?? '').replace(/[,₹\s]/g, '');
          const salesRupees = salesRaw ? Number(salesRaw) : NaN;
          contacts.push({
            phone,
            name: (r[iName] as string) || undefined,
            city: (r[iCity] as string) || undefined,
            email: (r[iEmail] as string) || undefined,
            totalOrders: Number(r[iOrders]) || undefined,
            totalSalesPaise: Number.isFinite(salesRupees) ? Math.round(salesRupees * 100) : undefined,
          });
        }
        resolve({ contacts, skipped });
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function StatsLine({ campaignId }: { campaignId: string }) {
  const stats = useQuery(api.marketing.campaignStats, { campaignId: campaignId as never });
  if (!stats) return <span className="text-xs text-gray-400">…</span>;
  return (
    <span className="text-xs text-gray-500">
      {stats.sent} sent · {stats.uniqueClicks} clicks · {stats.orders} orders
      {stats.orders > 0 && ` · ₹${(stats.revenuePaise / 100).toLocaleString('en-IN')}`}
    </span>
  );
}

type Tab = 'contacts' | 'templates' | 'campaigns' | 'send';

export function MarketingPage() {
  const org = useOrg();
  const orgId = org?._id;
  const [tab, setTab] = useState<Tab>('send');
  const [search, setSearch] = useState('');
  const [sendSearch, setSendSearch] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignTemplateId, setCampaignTemplateId] = useState('');
  const [campaignCoupon, setCampaignCoupon] = useState('');
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const sendBoxRef = useRef<HTMLTextAreaElement>(null);

  const contactCount = useQuery(api.marketing.countContacts, orgId ? { orgId } : 'skip');
  const contacts = useQuery(api.marketing.listContacts, orgId ? { orgId, search: tab === 'send' ? sendSearch : search } : 'skip');
  const campaigns = useQuery(api.marketing.listCampaigns, orgId ? { orgId } : 'skip');
  const templates = useQuery(api.marketing.listTemplates, orgId ? { orgId } : 'skip');
  const discounts = useQuery(api.discounts.listDiscountsForAdmin, { orgSlug: ORG_SLUG });
  const sentIds = useQuery(
    api.marketing.sentContactIds,
    activeCampaignId ? { campaignId: activeCampaignId as never } : 'skip',
  );

  const upsertContacts = useMutation(api.marketing.upsertContacts);
  const createCampaign = useMutation(api.marketing.createCampaign);
  const updateCampaign = useMutation(api.marketing.updateCampaign);
  const recordSend = useMutation(api.marketing.recordSend);
  const createTemplate = useMutation(api.marketing.createTemplate);
  const updateTemplate = useMutation(api.marketing.updateTemplate);
  const deleteTemplate = useMutation(api.marketing.deleteTemplate);

  const activeCampaign = useMemo(
    () => campaigns?.find((c) => c._id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId],
  );
  const sentSet = useMemo(() => new Set((sentIds ?? []).map(String)), [sentIds]);
  const couponMatch = useMemo(() => {
    const want = campaignCoupon.trim().toUpperCase();
    if (!want) return null;
    return (discounts ?? []).find((d) => (d.code ?? '').toUpperCase() === want) ?? null;
  }, [campaignCoupon, discounts]);

  const insertVariable = (tag: string) => {
    const el = sendBoxRef.current;
    if (!el) {
      setCampaignMessage((m) => `${m}${tag}`);
      return;
    }
    const start = el.selectionStart ?? campaignMessage.length;
    const end = el.selectionEnd ?? campaignMessage.length;
    setCampaignMessage(campaignMessage.slice(0, start) + tag + campaignMessage.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + tag.length;
    });
  };

  const handleFile = async (file: File) => {
    if (!orgId) return;
    setImporting(file.name);
    try {
      const { contacts: parsed, skipped } = await parseWorkbook(file);
      let inserted = 0;
      let updated = 0;
      let skippedTotal = skipped;
      for (let i = 0; i < parsed.length; i += 400) {
        const r = await upsertContacts({ orgId, source: file.name, contacts: parsed.slice(i, i + 400) });
        inserted += r.inserted;
        updated += r.updated;
        skippedTotal += r.skipped;
      }
      setOpOk(`Imported ${inserted} new, ${updated} updated, ${skippedTotal} skipped`);
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCreateCampaign = async () => {
    if (!orgId) return;
    try {
      const id = await createCampaign({
        orgId,
        name: campaignName,
        message: campaignMessage,
        templateId: (campaignTemplateId || undefined) as never,
        couponCode: campaignCoupon.trim() || undefined,
        discountId: (couponMatch?._id ?? undefined) as never,
      });
      setCampaignName('');
      setCampaignMessage('');
      setCampaignTemplateId('');
      setCampaignCoupon('');
      setActiveCampaignId(id);
      setTab('send');
      setOpOk('Campaign created — pick contacts to send');
    } catch {
      setOpError('Could not create campaign');
    }
  };

  const handleSaveCampaign = async () => {
    if (!activeCampaign) return;
    try {
      await updateCampaign({ campaignId: activeCampaign._id, name: activeCampaign.name, message: campaignMessage });
      setOpOk('Campaign saved');
    } catch {
      setOpError('Could not save campaign');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!orgId || !campaignMessage.trim()) return;
    try {
      await createTemplate({ orgId, name: `${activeCampaign?.name ?? 'Message'} copy`, message: campaignMessage });
      setOpOk('Saved as template');
    } catch {
      setOpError('Could not save template');
    }
  };

  const handleSaveTemplate = async () => {
    if (!orgId) return;
    try {
      if (editingTemplateId) {
        await updateTemplate({ templateId: editingTemplateId as never, name: templateName, message: templateMessage });
        setEditingTemplateId(null);
      } else {
        await createTemplate({ orgId, name: templateName, message: templateMessage });
      }
      setTemplateName('');
      setTemplateMessage('');
      setOpOk('Template saved');
    } catch {
      setOpError('Could not save template');
    }
  };

  const handleSend = async (contactId: string, phone: string, text: string) => {
    if (!activeCampaignId) {
      setOpError('Select a campaign first');
      return;
    }
    window.open(waLink(phone, text), '_blank', 'noopener');
    try {
      await recordSend({ campaignId: activeCampaignId as never, contactId: contactId as never });
    } catch {
      setOpError('Opened WhatsApp but could not record the send');
    }
  };

  const rows = useMemo(
    () =>
      (contacts ?? []).map((c) => ({
        id: c._id,
        contactId: c._id,
        phone: c.phone,
        name: c.name ?? '—',
        city: c.city ?? '—',
        totalOrders: c.totalOrders ?? 0,
      })),
    [contacts],
  );

  const extrasFor = (contactId: string) => ({
    code: activeCampaign?.couponCode ?? '',
    link: activeCampaignId ? trackLink(activeCampaignId, contactId) : '',
  });

  const previewContact = rows[0];
  const previewText = previewContact && activeCampaign
    ? renderMessage(campaignMessage, previewContact, extrasFor(previewContact.contactId))
    : '';

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader
        title="Marketing"
        description={contactCount !== undefined ? `${contactCount.toLocaleString('en-IN')} contacts` : 'WhatsApp campaigns'}
        search={
          tab === 'send'
            ? { value: sendSearch, onChange: setSendSearch, placeholder: 'Search send list...' }
            : tab === 'contacts'
              ? { value: search, onChange: setSearch, placeholder: 'Search contacts...' }
              : undefined
        }
      >
        <div className="flex gap-1 rounded-lg border border-[var(--color-coyote)]/30 p-1">
          {(['contacts', 'templates', 'campaigns', 'send'] as Tab[]).map((t) => (
            <Button
              key={t}
              variant={tab === t ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <InlineStatus status={opStatus} />

        {tab === 'contacts' && (
          <>
            <AdminCard>
              <AdminCardContent className="flex flex-wrap items-center gap-3 py-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={!!importing || !orgId}>
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? `Importing ${importing}...` : 'Upload customer Excel'}
                </Button>
                <p className="text-sm text-gray-500">
                  .xlsx with Mobile Number / Customer Name / City columns. Deduped by phone.
                </p>
              </AdminCardContent>
            </AdminCard>
            <DataTable
              data={rows}
              loading={contacts === undefined}
              searchTerm=""
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'city', label: 'City' },
                { key: 'totalOrders', label: 'Orders' },
              ]}
            />
          </>
        )}

        {tab === 'templates' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminCard>
              <AdminCardHeader>
                <AdminCardTitle>{editingTemplateId ? 'Edit template' : 'New template'}</AdminCardTitle>
              </AdminCardHeader>
              <AdminCardContent className="space-y-3">
                <Input
                  placeholder="Template name (e.g. Festive offer)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <Textarea
                  rows={8}
                  placeholder={'Hi {{firstname}}! ... {{code}} ... {{link}}'}
                  value={templateMessage}
                  onChange={(e) => setTemplateMessage(e.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {VARIABLES.map((v) => (
                    <Button
                      key={v.tag}
                      size="sm"
                      variant="outline"
                      onClick={() => setTemplateMessage((m) => `${m}${v.tag}`)}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || !templateMessage.trim()}>
                    <Plus className="h-4 w-4 mr-2" /> {editingTemplateId ? 'Update' : 'Save template'}
                  </Button>
                  {editingTemplateId && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingTemplateId(null);
                        setTemplateName('');
                        setTemplateMessage('');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </AdminCardContent>
            </AdminCard>
            <div className="space-y-3">
              {(templates ?? []).map((t) => (
                <AdminCard key={t._id}>
                  <AdminCardContent className="py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-sm text-gray-500 truncate">{t.message.slice(0, 120)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCampaignTemplateId(t._id);
                          setCampaignMessage(t.message);
                          setTab('campaigns');
                        }}
                      >
                        Use
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingTemplateId(t._id);
                          setTemplateName(t.name);
                          setTemplateMessage(t.message);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete template "${t.name}"?`)) {
                            deleteTemplate({ templateId: t._id }).catch(() => setOpError('Could not delete template'));
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </AdminCardContent>
                </AdminCard>
              ))}
              {templates?.length === 0 && <p className="text-sm text-gray-500">No templates yet — save your first copy block.</p>}
            </div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminCard>
              <AdminCardHeader>
                <AdminCardTitle>New campaign</AdminCardTitle>
              </AdminCardHeader>
              <AdminCardContent className="space-y-3">
                <Input
                  placeholder="Campaign name (e.g. Diwali blast)"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
                <select
                  className="w-full rounded-md border border-[var(--color-coyote)]/40 bg-white px-3 py-2 text-sm"
                  value={campaignTemplateId}
                  onChange={(e) => {
                    setCampaignTemplateId(e.target.value);
                    const t = templates?.find((x) => x._id === e.target.value);
                    if (t) setCampaignMessage(t.message);
                  }}
                >
                  <option value="">Start from blank…</option>
                  {(templates ?? []).map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Textarea
                  rows={8}
                  placeholder={'Hi {{firstname}}! ... Use {{code}} ... {{link}}'}
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                />
                <div className="text-xs text-gray-500">
                  Preview: {renderMessage(campaignMessage || 'Hi {{firstname}}!', { name: 'Augustin', city: 'Bangalore' }, { code: 'DIWALI10', link: `${trackBase()}/m?…` }).slice(0, 200)}
                </div>
                <div>
                  <Input
                    placeholder="Coupon code for this blast (e.g. DIWALI10)"
                    value={campaignCoupon}
                    onChange={(e) => setCampaignCoupon(e.target.value.toUpperCase())}
                  />
                  {campaignCoupon.trim() && (
                    <p className={`text-xs mt-1 ${couponMatch ? 'text-green-700' : 'text-amber-700'}`}>
                      {couponMatch
                        ? `Matched: ${couponMatch.name} — orders with this coupon count toward the campaign.`
                        : 'No matching discount yet — create it under Discounts first, or orders won\'t attribute.'}
                    </p>
                  )}
                </div>
                <Button onClick={handleCreateCampaign} disabled={!campaignName.trim() || !campaignMessage.trim()}>
                  <Plus className="h-4 w-4 mr-2" /> Create campaign
                </Button>
              </AdminCardContent>
            </AdminCard>
            <div className="space-y-3">
              {(campaigns ?? []).map((c) => (
                <AdminCard key={c._id}>
                  <AdminCardContent className="py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {c.name}
                        {c.couponCode && <Badge variant="outline" className="ml-2">{c.couponCode}</Badge>}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{c.message.slice(0, 100)}</div>
                      <StatsLine campaignId={c._id} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={activeCampaignId === c._id ? 'default' : 'outline'}
                        onClick={() => {
                          setActiveCampaignId(c._id);
                          setCampaignMessage(c.message);
                          setTab('send');
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" /> Send
                      </Button>
                    </div>
                  </AdminCardContent>
                </AdminCard>
              ))}
              {campaigns?.length === 0 && <p className="text-sm text-gray-500">No campaigns yet.</p>}
            </div>
          </div>
        )}

        {tab === 'send' && (
          <>
            <AdminCard>
              <AdminCardContent className="py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    className="rounded-md border border-[var(--color-coyote)]/40 bg-white px-3 py-2 text-sm"
                    value={activeCampaignId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      setActiveCampaignId(id);
                      const c = campaigns?.find((x) => x._id === id);
                      if (c) setCampaignMessage(c.message);
                    }}
                  >
                    <option value="">Select campaign...</option>
                    {(campaigns ?? []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.sentCount} sent)
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-[var(--color-coyote)]/40 bg-white px-3 py-2 text-sm"
                    value=""
                    onChange={(e) => {
                      const t = templates?.find((x) => x._id === e.target.value);
                      if (t) {
                        setCampaignMessage(t.message);
                        setOpOk(`Swapped to template "${t.name}" — save to keep it on this campaign`);
                      }
                    }}
                  >
                    <option value="">Swap template…</option>
                    {(templates ?? []).map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {activeCampaign && (
                    <>
                      <Button size="sm" variant="outline" onClick={handleSaveCampaign}>
                        Save to campaign
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleSaveAsTemplate}>
                        Save as template
                      </Button>
                    </>
                  )}
                </div>
                {activeCampaign && (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {VARIABLES.map((v) => (
                        <Button key={v.tag} size="sm" variant="outline" onClick={() => insertVariable(v.tag)}>
                          {v.label}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      ref={sendBoxRef}
                      rows={5}
                      value={campaignMessage}
                      onChange={(e) => setCampaignMessage(e.target.value)}
                    />
                    {previewText && (
                      <div className="rounded-md bg-[var(--color-creme-light)] border border-[var(--color-coyote)]/30 p-3 text-sm whitespace-pre-wrap">
                        <span className="text-xs text-gray-400 block mb-1">
                          Preview as {previewContact?.name} ({previewText.length} chars)
                        </span>
                        {previewText}
                      </div>
                    )}
                  </>
                )}
              </AdminCardContent>
            </AdminCard>
            <DataTable
              data={rows}
              loading={contacts === undefined}
              searchTerm=""
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'city', label: 'City' },
                {
                  key: 'id',
                  label: 'Status',
                  render: (_: string, item: { id: string }) =>
                    activeCampaignId && sentSet.has(item.id) ? (
                      <Badge variant="outline">Sent</Badge>
                    ) : (
                      <span className="text-sm text-gray-400">Not sent</span>
                    ),
                },
                {
                  key: 'contactId',
                  label: 'WhatsApp',
                  render: (_: string, item: { id: string; contactId: string; phone: string; name: string; city: string }) => (
                    <Button
                      size="sm"
                      disabled={!activeCampaignId}
                      onClick={() =>
                        handleSend(
                          item.contactId,
                          item.phone,
                          renderMessage(campaignMessage, { name: item.name, city: item.city, phone: item.phone }, extrasFor(item.contactId)),
                        )
                      }
                    >
                      <MessageCircle className="h-3 w-3 mr-1" /> Open chat
                    </Button>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
}
