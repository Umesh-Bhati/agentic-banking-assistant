import { ScrollView, View, Text } from 'react-native';
import { useChat } from '../../../context/ChatContext';
import { CardSelectionCard } from '../../cards/components/CardSelectionCard';
import { StatementCard } from '../../statements/components/StatementCard';
const displayFields = new Set(['account_number', 'account_type', 'balance', 'available_balance', 'currency', 'description', 'amount', 'date', 'transaction_date', 'type', 'status', 'name', 'product_name', 'last4', 'card_type', 'created_at', 'last_4', 'product_number']);
export function BankingEvents() {
  const { uiEvents } = useChat();
  if (!uiEvents.length) return null;
  return <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ padding: 12, gap: 12 }}>
    <Text style={{ fontWeight: '700' }}>Bank records and operations</Text>
    {uiEvents.map((event, index) => {
      if (event.type === 'CARD_SELECTION') return <CardSelectionCard key={'card-' + event.data.actionId} actionId={event.data.actionId} cards={event.data.cards} />;
      if (event.type === 'STATEMENT_QUOTE') return <StatementCard key={'statement-' + event.data.statementId} data={event.data} />;
      return <View key={'data-' + index} style={{ gap: 8 }}><Text>{event.data.kind}</Text>{event.data.items.map((item, row) => <View key={row} style={{ borderBottomWidth: 1, borderColor: '#ddd', padding: 8 }}>{Object.entries(item).filter(([key, value]) => displayFields.has(key) && (typeof value === 'string' || typeof value === 'number')).map(([key, value]) => <Text key={key}>{key.replace(/_/g, ' ')}: {String(value)}</Text>)}</View>)}</View>;
    })}
  </ScrollView>;
}
