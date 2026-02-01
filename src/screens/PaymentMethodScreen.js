// screens/PaymentMethodScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Show, Render } from '../components/SafeConditional';


export default function PaymentMethodScreen({ route, navigation }) {
  const { subject, user } = route.params;

  return (
    <View style={styles.container}>
      {/* ================= BACK ================= */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation?.goBack?.()}
      >
        <Icon name="arrow-left" size={26} color="#001F54" />
      </TouchableOpacity>

      {/* ================= TITLE ================= */}
      <Text style={styles.title}>
        Choose Payment Method
      </Text>

      {/* ================= SUBJECT INFO ================= */}
      <Text style={styles.subjectText}>
        {typeof subject?.name === 'string' ? subject.name : 'Subject'} —{' '}
        <Text style={{ fontWeight: '700' }}>
          ₦{Number(subject?.price) || '3000'}
        </Text>
      </Text>

      {/* ================= OFFLINE CODE ================= */}
      <TouchableOpacity
        style={[styles.button, styles.codeBtn]}
        onPress={() => {
          if (navigation?.navigate) {
            navigation.navigate('OfflineCode', {
              subject: subject ?? {},
              user: user ?? {},
            });
          }
        }}
      >
        <Text style={styles.buttonText}>
          Enter Offline Code
        </Text>
      </TouchableOpacity>

      {/* ================= MANUAL PAYMENT ================= */}
      <TouchableOpacity
        style={[styles.button, styles.manualBtn]}
        onPress={() => {
          if (navigation?.navigate) {
            navigation.navigate('ManualPayment', {
              subject: subject ?? {},
              user: user ?? {},
            });
          }
        }}
      >
        <Text style={styles.buttonText}>
          I paid manually (enter reference)
        </Text>
      </TouchableOpacity>

      {/* ================= ONLINE PAYMENT ================= */}
      <TouchableOpacity
        style={[styles.button, styles.onlineBtn]}
        onPress={() => {
          if (navigation?.navigate) {
            navigation.navigate('OnlinePaymentHelper', {
              subject: subject ?? {},
              user: user ?? {},
            });
          }
        }}
      >
        <Text style={styles.buttonText}>
          Pay Online (opens browser)
        </Text>
      </TouchableOpacity>
    </View>
  );

}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30 },
  backBtn: { marginBottom: 10, width: 35 },
  title: { fontSize: 22, fontWeight: '700', color: '#001F54', marginBottom: 10 },
  subjectText: { fontSize: 18, color: '#333', marginBottom: 20 },
  button: { padding: 14, borderRadius: 10, marginBottom: 20 },
  codeBtn: { backgroundColor:  '#001F54', borderWidth: 20, borderColor: '#fff' },
  manualBtn: { backgroundColor: '#001F54', borderWidth: 20, borderColor: '#fff' },
  onlineBtn: { backgroundColor: '#001F54', borderWidth: 20, borderColor: '#fff' },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
});
