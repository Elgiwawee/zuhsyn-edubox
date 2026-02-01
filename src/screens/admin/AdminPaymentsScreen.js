import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { getDBConnection } from '../../utils/database';
import {
  markPendingPaymentAsPaid,
  rejectPendingPayment,
} from '../../utils/dbHelper';
import AdminHeader from '../../components/AdminHeader';
import { Show } from '../../components/SafeConditional';

export default function AdminPaymentsScreen() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);

  const loadPending = async () => {
    setLoading(true);

    const db = await getDBConnection();
    try {
      const res = await db.executeSql(`
        SELECT p.*, u.name AS username
        FROM pending_payments p
        LEFT JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC;
      `);

      const items = [];
      const rows = res[0].rows;

      for (let i = 0; i < rows.length; i++) {
        items.push(rows.item(i));
      }

      setPending(items);
    } catch (err) {
      console.error('Pending load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const approvePayment = async (id) => {
    try {
      await markPendingPaymentAsPaid(id);
      Alert.alert('Approved', 'Payment marked as PAID & user unlocked.');
      loadPending();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to approve');
    }
  };

  const rejectPayment = async (id) => {
    Alert.alert(
      'Reject Payment?',
      'Are you sure you want to reject this payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectPendingPayment(id);
              Alert.alert('Rejected', 'Payment marked as FAILED.');
              loadPending();
            } catch (e) {
              Alert.alert('Error', e.message || 'Reject failed');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* HEADER */}
      <AdminHeader title="Pending Payments" />

      {/* LOADING */}
      <Show when={loading === true}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#001F54" />
        </View>
      </Show>

      {/* EMPTY STATE */}
      <Show when={!loading && pending.length === 0}>
        <View style={styles.center}>
          <Text>No pending payments</Text>
        </View>
      </Show>

      {/* LIST */}
      <Show when={!loading && pending.length > 0}>
        <FlatList
          data={pending}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 15 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>
                {item.subject_name} — ₦{item.amount}
              </Text>

              <Text style={styles.meta}>
                User: {item.username} (ID {item.user_id})
              </Text>

              <Text style={styles.meta}>
                Method: {item.payment_method}
              </Text>

              <Text style={styles.meta}>
                Date: {item.created_at}
              </Text>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#2ecc71' }]}
                  onPress={() => approvePayment(item.id)}
                >
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#e74c3c' }]}
                  onPress={() => rejectPayment(item.id)}
                >
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </Show>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#001F54',
  },
  meta: {
    color: '#666',
    marginTop: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  btn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  btnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
});
