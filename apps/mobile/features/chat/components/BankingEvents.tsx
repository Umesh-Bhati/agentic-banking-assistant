import { View, Text, StyleSheet } from 'react-native';
import { useChat } from '../../../context/ChatContext';
import { useTheme } from '../../../hooks/use-theme';
import { CardSelectionCard } from '../../cards/components/CardSelectionCard';
import { StatementCard } from '../../statements/components/StatementCard';

const labels: Record<string, string> = {
  account_type: 'Account type', balance: 'Balance', available_balance: 'Available balance',
  type: 'Type', status: 'Status', card_type: 'Card type',
};
const titles: Record<string, string> = {
  accounts: 'Your accounts', balance: 'Account balance', transactions: 'Recent transactions',
  products: 'Your products', cards: 'Your cards',
};
function field(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}
function dateLabel(value: string) {
  if (!value) return '';
  const date = new Date(value.length === 10 ? value + 'T12:00:00Z' : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function money(value: string, currency: string) {
  const number = Number(value);
  return value !== '' && Number.isFinite(number)
    ? [currency, number.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })].filter(Boolean).join(' ')
    : value;
}
function BankRecord({ item, kind }: { item: Record<string, unknown>; kind: string }) {
  const { colors } = useTheme();
  const currency = field(item, 'currency');
  const title = field(item, 'description', 'product_name', 'name', 'account_type', 'card_type') || (kind === 'transactions' ? 'Transaction' : 'Account');
  const number = field(item, 'last4', 'last_4', 'account_number', 'product_number');
  const date = dateLabel(field(item, 'transaction_date', 'date', 'created_at'));
  const amount = field(item, 'amount');
  return <View style={[styles.record, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {amount !== '' && <Text style={[styles.amount, { color: colors.foreground }]}>{money(amount, currency)}</Text>}
    </View>
    {!!number && <Text style={{ color: colors.mutedForeground }}>Ending in •••• {number.slice(-4)}</Text>}
    {!!date && <Text style={{ color: colors.mutedForeground }}>{date}</Text>}
    {Object.entries(labels).map(([key, label]) => {
      const value = field(item, key);
      if (!value || value === title) return null;
      const formatted = key.includes('balance') ? money(value, currency) : value.replace(/_/g, ' ').toLowerCase();
      return <View key={key} style={styles.row}>
        <Text style={{ color: colors.mutedForeground }}>{label}</Text>
        <Text style={[styles.value, { color: colors.foreground }]}>{formatted}</Text>
      </View>;
    })}
  </View>;
}
export function BankingEvents({ bankingTurnId }: { bankingTurnId?: string }) {
  const { uiEvents } = useChat();
  const { colors } = useTheme();
  const events = bankingTurnId ? uiEvents.filter(event => event.bankingTurnId === bankingTurnId) : [];
  if (!events.length) return null;
  return <View style={styles.events}>
    {events.map((event, index) => {
      if (event.type === 'CARD_SELECTION') return <CardSelectionCard key={'card-' + event.data.actionId} actionId={event.data.actionId} cards={event.data.cards} />;
      if (event.type === 'STATEMENT_QUOTE') return <StatementCard key={'statement-' + event.data.statementId} data={event.data} />;
      return <View key={'data-' + index} style={styles.records}>
        <Text style={[styles.heading, { color: colors.foreground }]}>{titles[event.data.kind] || 'Account details'}</Text>
        {event.data.items.length === 0 && <Text style={{ color: colors.mutedForeground }}>No records found.</Text>}
        {event.data.items.map((item, row) => <BankRecord key={row} kind={event.data.kind} item={item} />)}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  events: { width: '100%', gap: 12, marginTop: 12 },
  records: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '600' },
  record: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  value: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
