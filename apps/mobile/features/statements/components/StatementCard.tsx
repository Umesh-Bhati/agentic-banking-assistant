import { useEffect, useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import type { StatementQuoteData } from '@boit/shared-types';
import { useChat } from '../../../context/ChatContext';
import { json } from '../../../lib/api/client';
import { resourceId } from '../../../lib/api/policy';
import { actions, type ActionResult } from '../../actions/services/actions';
import { downloadStatement } from '../services/download';
export function StatementCard({ data }: { data: StatementQuoteData }) {
  const { authToken, beginAuthorization } = useChat();
  const [status, setStatus] = useState(data.status);
  useEffect(() => setStatus(data.status), [data.status]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (operation: () => Promise<void>) => { setBusy(true); setError(''); try { await operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Statement request failed'); } finally { setBusy(false); } };
  const confirm = () => run(async () => {
    if (!authToken) throw new Error('Sign in again');
    const result = await json<ActionResult>('/api/statements/' + resourceId(data.statementId) + '/confirm', authToken, {});
    if (result.action.status !== 'PENDING_AUTHORIZATION') throw new Error('Statement confirmation was not accepted');
    beginAuthorization({ actionId: data.actionId, cardType: 'Statement fee: ' + data.fee + ' ' + data.currency, last4: '' });
  });
  const refresh = () => run(async () => {
    if (!authToken) throw new Error('Sign in again');
    const result = await actions.status(authToken, data.actionId); setStatus(result.action.status);
    if (result.action.status === 'PENDING_AUTHORIZATION') beginAuthorization({ actionId: data.actionId, cardType: 'Statement fee: ' + data.fee + ' ' + data.currency, last4: '' });
  });
  return <View style={{ padding: 16, gap: 12, borderWidth: 1, borderColor: '#bbb', borderRadius: 12 }}>
    <Text style={{ fontWeight: '700' }}>Account statement</Text><Text>{data.fromDate} to {data.toDate}</Text>
    <Text>Fee: {data.fee} {data.currency}</Text><Text>Debit account: {data.debitAccountLabel}</Text>
    <Text>Bank status: {status}</Text>
    {!['COMPLETED', 'ISSUED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(status) && <Button title={'Accept ' + data.fee + ' ' + data.currency + ' fee and authorize'} disabled={busy} onPress={confirm} />}
    <Button title="Check bank status / resume authorization" disabled={busy} onPress={refresh} />
    {['COMPLETED', 'ISSUED'].includes(status) && <Button title="Save / share PDF" disabled={busy} onPress={() => run(async () => { if (!authToken) throw new Error('Sign in again'); await downloadStatement(authToken, data.statementId); })} />}
    {busy && <ActivityIndicator />}{!!error && <Text accessibilityRole="alert" style={{ color: '#991b1b' }}>{error}</Text>}
  </View>;
}
