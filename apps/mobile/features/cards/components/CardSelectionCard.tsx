import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';
import Constants from 'expo-constants';

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

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri;
    const localhost = debuggerHost?.split(':')[0] || 'localhost';
    return `http://${localhost}:3000`;
  }
  return 'http://localhost:3000';
};

export function CardSelectionCard({ actionId, cards }: CardSelectionCardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { authToken, setPinModalData, setShowPinModal } = useChat();

  const handleSelectCard = async (card: CardItem) => {
    setSelectedCardId(card.id);
    setLoadingCardId(card.id);
    setErrorMessage(null);

    const targetActionId = actionId || 'act_demo';

    try {
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      // Step 1: Execute Confirmation (Transitions PENDING_SELECTION -> PENDING_CONFIRMATION -> PENDING_AUTHORIZATION)
      const response = await fetch(`${baseUrl}/actions/${targetActionId}/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cardId: card.id }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Step 1 Succeeded! Set pin modal data & trigger Step 2: Native PinModal popup
        setPinModalData({
          actionId: targetActionId,
          cardId: card.id,
          cardType: card.type || card.cardType || 'Credit',
          last4: card.last4,
        } as any);
        setShowPinModal(true);
      } else {
        setErrorMessage(data.error || 'Failed to confirm card selection.');
      }
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
        {cards.map((card) => {
          const isSelected = selectedCardId === card.id;
          const isLoading = loadingCardId === card.id;
          const cardName = card.type || card.cardType || 'Credit Card';

          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.cardItem, isSelected && styles.cardItemSelected]}
              onPress={() => handleSelectCard(card)}
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
                onPress={() => handleSelectCard(card)}
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
