import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AdminHeader from '../../components/AdminHeader';

export default function AdminDashboardScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* HEADER */}
        <AdminHeader title="Admin Dashboard" />

        {/* GENERATE CODES */}
        <TouchableOpacity
          style={[styles.box, { backgroundColor: '#0066FF' }]}
          onPress={() => navigation.navigate('AdminGenerateCodes')}
          activeOpacity={0.8}
        >
          <Icon name="barcode" size={32} color="#fff" />
          <Text style={styles.boxText}>Generate Offline Codes</Text>
        </TouchableOpacity>

        {/* PAYMENTS */}
        <TouchableOpacity
          style={[styles.box, { backgroundColor: '#009688' }]}
          onPress={() => navigation.navigate('AdminPayments')}
          activeOpacity={0.8}
        >
          <Icon name="cash-check" size={32} color="#fff" />
          <Text style={styles.boxText}>Verify Pending Payments</Text>
        </TouchableOpacity>

        {/* ANALYTICS */}
        <TouchableOpacity
          style={[styles.box, { backgroundColor: '#FF5722' }]}
          onPress={() => navigation.navigate('AdminAnalytics')}
          activeOpacity={0.8}
        >
          <Icon name="chart-line" size={32} color="#fff" />
          <Text style={styles.boxText}>View Analytics</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  box: {
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 15,
    elevation: 2,
  },
  boxText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
