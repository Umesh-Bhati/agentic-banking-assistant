import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';
import { actions, type ActionResult } from '../../actions/services/actions';
import { json } from '../../../lib/api/client';
import { resourceId } from '../../../lib/api/policy';

interface CardItem {
  id: string;
  type?: string;
  cardType?: string;
  last4: string;
}

interface CardSelectionCardProps {
  actionId?: string;
  cards: CardItem[];
}

export function CardSelectionCard({ actionId, cards }: CardSelectionCardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bankStatus, setBankStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { authToken, beginAuthorization, showPinModal } = useChat();

  const rememberStatus = (action: ActionResult['action']) => {
    setBankStatus(action.status);
    const metadata = 'metadata' in action ? action.metadata : undefined;
    const cardId = metadata && typeof metadata === 'object' && 'cardId' in metadata ? metadata.cardId : undefined;
    const selected = cards.find(card => card.id === cardId);
    setSelectedCardId(selected?.id || null);
    return selected;
  };

  useEffect(() => {
    if (!authToken || !actionId || showPinModal) return;
    let current = true;
    setChecking(true);
    void actions.status(authToken, actionId).then(({ action }) => {
      if (current) { rememberStatus(action); setErrorMessage(null); }
    }).catch(() => {
      if (current) setErrorMessage('Unable to check bank status. Refresh before retrying.');
    }).finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, [authToken, actionId, showPinModal]);

  const refreshStatus = async (resume = false) => {
    if (!authToken || !actionId) return;
    setChecking(true); setErrorMessage(null);
    try {
      const { action } = await actions.status(authToken, actionId);
      const card = rememberStatus(action);
      if (resume && action.status === 'PENDING_AUTHORIZATION') {
        if (!card) throw new Error('The selected card is unavailable. Start a new operation.');
        beginAuthorization({ actionId, cardType: card.type || card.cardType || 'Card', last4: card.last4 });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to check bank status.');
    } finally { setChecking(false); }
  };

  const handleSelectCard = async (card: CardItem) => {
    setLoadingCardId(card.id);
    setErrorMessage(null);

    try {
      if (!authToken || !actionId) throw new Error('Missing authenticated operation');
      const current = await actions.status(authToken, actionId);
      const selected = rememberStatus(current.action);
      if (!['PENDING_SELECTION', 'PENDING_CONFIRMATION'].includes(current.action.status)) {
        setErrorMessage('Bank status has changed. Review it before continuing.');
        return;
      }
      if (current.action.status === 'PENDING_CONFIRMATION' && selected?.id !== card.id) {
        throw new Error('A different card is already selected for this operation.');
      }
      const result = current.action.status === 'PENDING_CONFIRMATION'
        ? await json<ActionResult>(`/actions/${resourceId(actionId)}/confirm`, authToken, {})
        : await actions.confirm(authToken, actionId, card.id);
      rememberStatus(result.action);
      if (result.action.status !== 'PENDING_AUTHORIZATION') throw new Error('Card selection was not confirmed');
      beginAuthorization({ actionId, cardType: card.type || card.cardType || 'Card', last4: card.last4 });
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Unable to confirm card selection. Check bank status before retrying.');
    } finally {
      setLoadingCardId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>💳 Select Card to Block</Text>
      <Text>Bank status: {bankStatus || 'Checking…'}</Text>
      {bankStatus === 'COMPLETED' && <Text>The bank confirmed this card block.</Text>}
      {bankStatus === 'AUTHORIZED' && <Text>Authorization is recorded; execution is not yet confirmed. Check status before starting another operation.</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={checking || loadingCardId !== null} onPress={() => refreshStatus(bankStatus === 'PENDING_AUTHORIZATION')} style={styles.selectButton}>
        <Text style={styles.selectButtonText}>{checking ? 'Checking bank status…' : bankStatus === 'PENDING_AUTHORIZATION' ? 'Check status / resume authorization' : 'Check bank status'}</Text>
      </TouchableOpacity>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.cardList}>
        {cards.map((card, index) => {
          const uniqueId = card.id;
          const isSelected = selectedCardId === uniqueId;
          const isLoading = loadingCardId === uniqueId;
          const cardName = card.type || card.cardType || 'Credit Card';

          return (
            <TouchableOpacity
              key={uniqueId}
              style={[styles.cardItem, isSelected && styles.cardItemSelected]}
              onPress={() => handleSelectCard({ ...card, id: uniqueId })}
              disabled={checking || loadingCardId !== null || !['PENDING_SELECTION', 'PENDING_CONFIRMATION'].includes(bankStatus || '')}
              activeOpacity={0.8}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardIcon}>💳</Text>
                <View>
                  <Text style={styles.cardTitle}>{cardName} Card</Text>
                  <Text style={styles.cardSubtitle}>Ending in •••• {card.last4}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.selectButton, isSelected && styles.selectButtonSelected]}
                onPress={() => handleSelectCard({ ...card, id: uniqueId })}
                disabled={checking || loadingCardId !== null || !['PENDING_SELECTION', 'PENDING_CONFIRMATION'].includes(bankStatus || '')}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.textLight} />
                ) : (
                  <Text style={styles.selectButtonText}>
                    {isSelected ? 'Selected' : 'Select'}
                  </Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  cardList: {
    gap: Spacing.md,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  selectButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
  },
  selectButtonSelected: {
    backgroundColor: Colors.success,
  },
  selectButtonText: {
    color: Colors.textLight,
    fontWeight: Typography.weight.semibold,
    fontSize: 13,
  },
});
