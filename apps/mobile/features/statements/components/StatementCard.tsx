import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { StatementCardData } from '@boit/shared-types';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../../constants/theme';
import { useChat } from '../../../context/ChatContext';

interface StatementCardProps {
  data: StatementCardData;
}

export function StatementCard({ data }: StatementCardProps) {
  const { authToken } = useChat();

  const handleOpenPdf = () => {
    if (data.url) {
      let targetUrl = data.url;
      if (authToken && !targetUrl.includes('token=')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}token=${encodeURIComponent(authToken)}`;
      }
      Linking.openURL(targetUrl).catch(() => {});
    }
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Text style={styles.headerIcon}>📄</Text>
        <View style={styles.headerTextContainer}>
          <Text style={styles.cardTitle}>Account Statement</Text>
          <Text style={styles.cardSubtitle}>Al Masraf Banking</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailsContainer}>
        {data.accountNumber && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Number</Text>
            <Text style={styles.detailValue}>{data.accountNumber}</Text>
          </View>
        )}

        {data.fromDate && data.toDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Period</Text>
            <Text style={styles.detailValue}>{data.fromDate} to {data.toDate}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Service Fee</Text>
          <Text style={styles.feeValue}>{(data.fee ?? 0).toFixed(2)} {data.currency || 'AED'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.downloadButton} onPress={handleOpenPdf}>
        <Text style={styles.downloadButtonText}>⬇ View / Download PDF</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: Typography.subtitle.fontSize,
    fontWeight: Typography.weight.bold,
    color: Colors.accent,
  },
  cardSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  detailsContainer: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: Typography.weight.medium,
    color: Colors.textPrimary,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: Typography.weight.bold,
    color: Colors.error,
  },
  downloadButton: {
    marginTop: 14,
    backgroundColor: Colors.accent,
    paddingVertical: 10,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: Colors.textLight,
    fontWeight: Typography.weight.semibold,
    fontSize: 14,
  },
});
