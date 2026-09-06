import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChatProvider, useChat } from '../context/ChatContext';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../constants/theme';

function CustomDrawerContent(props: any) {
  const {
    sessions,
    sessionId,
    handleNewChat,
    loadSession,
    deleteSession,
    handleLogout
  } = useChat();

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>Chat History</Text>
        <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeSidebarButton}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.newChatButton} onPress={() => {
        handleNewChat();
        props.navigation.closeDrawer();
      }}>
        <Text style={styles.newChatText}>+ New Chat</Text>
      </TouchableOpacity>

      <FlatList
        data={sessions}
        showsVerticalScrollIndicator={false}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.sessionItem, item.id === sessionId && styles.activeSessionItem]}>
            <TouchableOpacity style={styles.sessionSelect} onPress={() => {
              loadSession(item.id);
              props.navigation.closeDrawer();
            }}>
              <Text style={[styles.sessionTitle, item.id === sessionId && styles.activeSessionTitle]} numberOfLines={1}>
                {item.title || 'New Conversation'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteSession(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.sessionList}
      />
      <TouchableOpacity style={styles.sidebarLogoutButton} onPress={() => {
        handleLogout();
        props.navigation.closeDrawer();
      }}>
        <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
      </TouchableOpacity>
    </View>
  );
}

function DrawerLayout() {
  const { isLoggedIn } = useChat();

  return (
    <Drawer
      screenOptions={({ navigation }) => ({
        headerShown: isLoggedIn,
        headerStyle: { backgroundColor: Colors.accent },
        headerTintColor: Colors.textLight,
        headerTitle: 'Al Masraf Assistant',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => navigation.openDrawer()} 
            style={{ marginLeft: 16, padding: 4 }}
          >
            <Ionicons name="menu" size={26} color={Colors.textLight} />
          </TouchableOpacity>
        ),
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: Colors.background }
      })}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Drawer.Screen name="index" options={{ title: 'Al Masraf Assistant' }} />
    </Drawer>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ChatProvider>
        <DrawerLayout />
      </ChatProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  sidebar: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg, paddingTop: 60 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  sidebarTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.accent },
  closeSidebarButton: { padding: 8 },
  newChatButton: { backgroundColor: Colors.accent, padding: 12, borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.lg },
  newChatText: { color: Colors.textLight, fontWeight: 'bold' },
  sessionList: { paddingBottom: Spacing.xl },
  sessionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  activeSessionItem: { backgroundColor: Colors.accentSoft },
  sessionSelect: { flex: 1 },
  sessionTitle: { fontSize: 16, color: Colors.textPrimary },
  activeSessionTitle: { fontWeight: 'bold', color: Colors.accent },
  deleteButton: { padding: 8 },
  sidebarLogoutButton: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
});
