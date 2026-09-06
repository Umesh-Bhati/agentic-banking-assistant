import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../../hooks/use-theme';
import Markdown from 'react-native-markdown-display';
import { PinModal } from '../../auth/components/PinModal';
import { StatementCard } from '../../statements/components/StatementCard';
import { CardSelectionCard } from '../../cards/components/CardSelectionCard';
import { useChat } from '../../../context/ChatContext';

interface BankingMessageRendererProps {
  content: string;
}

export function BankingMessageRenderer({ content }: BankingMessageRendererProps) {
  const { colors } = useTheme();
  const { handlePinSubmit, handlePinCancel, pinLoading, pinError } = useChat();

  let textPart = content;
  let eventPayload: any = null;

  // Extract JSON object from code fences or raw JSON block
  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i;
  const jsonObjectRegex = /(\{[\s\S]*?"(?:type|event)"\s*:\s*"(?:CARD_SELECTION|STATEMENT_CARD|AUTH_REQUIRED)"[\s\S]*?\})/i;

  const codeMatch = content.match(codeBlockRegex);
  const jsonMatch = content.match(jsonObjectRegex);

  if (codeMatch) {
    try {
      eventPayload = JSON.parse(codeMatch[1]);
      textPart = content.replace(codeMatch[0], '').trim();
    } catch (e) {}
  } else if (jsonMatch) {
    try {
      eventPayload = JSON.parse(jsonMatch[1]);
      textPart = content.replace(jsonMatch[1], '').trim();
    } catch (e) {}
  } else {
    // Try full content JSON parse fallback
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        eventPayload = JSON.parse(trimmed);
        textPart = '';
      } catch (e) {}
    }
  }

  const isCardSelection = eventPayload && (
    eventPayload.type === 'CARD_SELECTION' || 
    eventPayload.event === 'CARD_SELECTION'
  );

  const realActionId = eventPayload?.actionId || eventPayload?.action_id || eventPayload?.id;
  const cardsList = eventPayload?.data?.cards || eventPayload?.selectedCards || eventPayload?.cards || [];

  return (
    <View style={styles.container}>
      {textPart ? (
        <Markdown style={{ body: { fontSize: 16, lineHeight: 25, color: colors.foreground } }}>
          {textPart}
        </Markdown>
      ) : null}

      {isCardSelection && cardsList.length > 0 ? (
        <CardSelectionCard actionId={realActionId} cards={cardsList} />
      ) : null}

      {eventPayload?.type === 'AUTH_REQUIRED' ? (
        <PinModal 
          visible={true}
          cardType={eventPayload.data?.cardType || eventPayload.cardType || 'Card'}
          last4={eventPayload.data?.last4 || eventPayload.last4 || '****'}
          onAuthSubmit={handlePinSubmit}
          onCancel={handlePinCancel}
          loading={pinLoading}
          error={pinError}
        />
      ) : null}

      {eventPayload?.type === 'STATEMENT_CARD' && eventPayload.data ? (
        <StatementCard data={eventPayload.data} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
});
