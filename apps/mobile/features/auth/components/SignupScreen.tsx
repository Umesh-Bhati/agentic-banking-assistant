import { View, Text, Button } from 'react-native';
export function SignupScreen({ onBackToLogin }: { onBackToLogin: () => void }) {
  return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 20 }}>
    <Text style={{ fontSize: 22, fontWeight: '700' }}>Bank-managed enrollment</Text>
    <Text>Contact the bank to open an account and complete identity verification. This app cannot approve your identity or fund an account.</Text>
    <Button title="Return to sign in" onPress={onBackToLogin} />
  </View>;
}
