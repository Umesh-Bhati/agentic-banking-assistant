import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';
import { actions } from '../../actions/services/actions';

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
  const { authToken, beginAuthorization } = useChat();

  const handleSelectCard = async (card: CardItem) => {
    setSelectedCardId(card.id);
    setLoadingCardId(card.id);
    setErrorMessage(null);

    try {
      if (!authToken || !actionId) throw new Error('Missing authenticated operation');
      const result = await actions.confirm(authToken, actionId, card.id);
      if (result.action.status !== 'PENDING_AUTHORIZATION') throw new Error('Card selection was not confirmed');
      beginAuthorization({ actionId, cardType: card.type || card.cardType || 'Card', last4: card.last4 });
    } catch (e) {
      console.warn('Error confirming card selection:', e);
      setErrorMessage('Network error confirming card selection.');
    } finally {
      setLoadingCardId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>💳 Select Card to Block</Text>
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
              disabled={loadingCardId !== null}
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
                disabled={loadingCardId !== null}
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
