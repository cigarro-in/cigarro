import { Button, Card, ErrorBanner, Input, Label, Switch } from '../../ui';
import { paiseToRupees, rupeesToPaise } from '../../../lib/convex/money';
import type { ReferralRewardRule, StoreReferralRules } from '../../../lib/storeSettings';
import type { SectionProps } from './sections';
import { SaveBar } from './SaveBar';
import { FieldGrid } from './FieldGrid';
import { useSettingsDraft } from './useSettingsDraft';

const REWARD_LABEL = { referrerReward: 'Referrer reward', refereeReward: 'New customer reward' } as const;
const REWARD_HINT = {
  referrerReward: 'Paid to the person who shared the code',
  refereeReward: 'Paid to the friend who joined with the code',
} as const;

/** Refer & earn rules. Off hides the program from customers entirely. */
export function ReferralSection({ live }: SectionProps) {
  const { draft, update, dirty, discard, save, feedback } = useSettingsDraft(live.referral);
  if (!draft) return null;
  const ref = draft;

  const patch = (p: Partial<StoreReferralRules>) => update((r) => ({ ...r, ...p }));

  // Fixed rewards are stored as paise; percent rewards as 0-100.
  const setRewardType = (key: 'referrerReward' | 'refereeReward', type: ReferralRewardRule['type']) =>
    patch({ [key]: { type, value: 0 } } as Partial<StoreReferralRules>);

  const setRewardValue = (key: 'referrerReward' | 'refereeReward', rule: ReferralRewardRule, input: number) => {
    const clean = Math.max(0, Number.isFinite(input) ? input : 0);
    const value = rule.type === 'fixed' ? rupeesToPaise(Math.floor(clean)) : Math.min(100, clean);
    patch({ [key]: { type: rule.type, value } } as Partial<StoreReferralRules>);
  };

  const onSave = () =>
    save((r) => {
      const rewardInvalid = (x: ReferralRewardRule) =>
        !Number.isFinite(x.value) || x.value < 0 || (x.type === 'percent' && x.value > 100);
      if (rewardInvalid(r.referrerReward) || rewardInvalid(r.refereeReward))
        throw new Error('Percent rewards must be between 0 and 100');
      if (r.minOrderPaise < 0 || r.maxRewardsPerReferrer < 0 || r.expiryDays < 0)
        throw new Error('Minimum order, reward cap and expiry cannot be negative');
      return {
        referral: {
          enabled: r.enabled,
          referrerReward: r.referrerReward,
          refereeReward: r.refereeReward,
          minOrderPaise: Math.round(r.minOrderPaise),
          creditWhen: r.creditWhen,
          maxRewardsPerReferrer: Math.floor(r.maxRewardsPerReferrer),
          expiryDays: Math.floor(r.expiryDays),
        },
      };
    });

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={feedback.error} />

      <Card title="Program">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="referral_on">Refer & earn is on</Label>
            <p className="text-xs text-muted-foreground">
              {ref.enabled ? 'Customers can invite friends and earn rewards' : 'Hidden from customers'}
            </p>
          </div>
          <Switch id="referral_on" checked={ref.enabled} onCheckedChange={(checked) => patch({ enabled: checked })} />
        </div>
      </Card>

      <Card title="Rewards">
        <FieldGrid>
          {(['referrerReward', 'refereeReward'] as const).map((key) => {
            const rule = ref[key];
            const isFixed = rule.type === 'fixed';
            return (
              <div key={key} className="flex flex-col gap-2">
                <Label>{REWARD_LABEL[key]}</Label>
                <p className="text-xs text-muted-foreground">{REWARD_HINT[key]}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant={isFixed ? 'primary' : 'secondary'} onClick={() => setRewardType(key, 'fixed')}>
                    Fixed ₹
                  </Button>
                  <Button size="sm" variant={!isFixed ? 'primary' : 'secondary'} onClick={() => setRewardType(key, 'percent')}>
                    % of order
                  </Button>
                </div>
                <Input
                  aria-label={isFixed ? 'Reward in rupees' : 'Reward percent of order'}
                  type="number"
                  min={0}
                  max={isFixed ? undefined : 100}
                  step={isFixed ? 1 : 0.5}
                  value={isFixed ? paiseToRupees(rule.value) : rule.value}
                  onChange={(e) => setRewardValue(key, rule, Number(e.target.value))}
                />
              </div>
            );
          })}
        </FieldGrid>
      </Card>

      <Card title="Conditions">
        <FieldGrid>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referral_min_order">Minimum order (₹)</Label>
            <Input
              id="referral_min_order"
              type="number"
              min={0}
              value={paiseToRupees(ref.minOrderPaise)}
              onChange={(e) => patch({ minOrderPaise: rupeesToPaise(Math.max(0, Number(e.target.value) || 0)) })}
            />
            <p className="text-xs text-muted-foreground">Smaller orders do not qualify.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Credit reward when</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={ref.creditWhen === 'paid' ? 'primary' : 'secondary'} onClick={() => patch({ creditWhen: 'paid' })}>
                Order paid
              </Button>
              <Button
                size="sm"
                variant={ref.creditWhen === 'delivered' ? 'primary' : 'secondary'}
                onClick={() => patch({ creditWhen: 'delivered' })}
              >
                Order delivered
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referral_max">Max rewards per referrer</Label>
            <Input
              id="referral_max"
              type="number"
              min={0}
              value={ref.maxRewardsPerReferrer}
              onChange={(e) => patch({ maxRewardsPerReferrer: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
            <p className="text-xs text-muted-foreground">0 means no limit.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referral_expiry">Credit expiry (days)</Label>
            <Input
              id="referral_expiry"
              type="number"
              min={0}
              value={ref.expiryDays}
              onChange={(e) => patch({ expiryDays: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
            <p className="text-xs text-muted-foreground">0 means credits never expire.</p>
          </div>
        </FieldGrid>
      </Card>

      <SaveBar dirty={dirty} state={feedback.state} onDiscard={discard} onSave={() => void onSave()} />
    </div>
  );
}
