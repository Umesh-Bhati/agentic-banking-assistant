import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { StatementCardData } from '@boit/types';

interface StatementCardProps {
  data: StatementCardData;
}

export function StatementCard({ data }: StatementCardProps) {
  const handleOpenPdf = () => {
    if (data.url) {
      Linking.openURL(data.url).catch(() => {});
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
          <Text style={styles.feeValue}>{data.fee.toFixed(2)} {data.currency || 'AED'}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#00838F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00838F',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  downloadButton: {
    marginTop: 14,
    backgroundColor: '#00838F',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
