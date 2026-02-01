// screens/ManualPaymentScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { saveManualPayment,submitManualPaymentPending,validatePaymentReference, getCurrentUser } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';


export default function ManualPaymentScreen({ route, navigation }) {
  const { subject } = route.params;
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(subject.price || '0'));
  const [loading, setLoading] = useState(false);


  const handleConfirm = async () => {
  if (!reference.trim()) {
    Alert.alert('Missing Reference', 'Enter your payment reference.');
    return;
  }
  if (!reference.startsWith("EDU-")) {
    Alert.alert("Invalid Reference", "Payment reference must start with EDU-");
    return;
  }

  setLoading(true);
  try {
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Login required'); setLoading(false); return; }

    const expected = Number(subject.price || 0);
    if (Number(amount) !== expected) {
      const cont = await new Promise(resolve => {
        Alert.alert(
          'Amount mismatch',
          `You entered ₦${amount} but the cost is ₦${expected}. Continue anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) }
          ]
        );
      });
      if (!cont) { setLoading(false); return; }
    }

    // 🔍 NEW PART (validate reference)
    const result = await validatePaymentReference(reference.trim(), {
      userId: user.id,
      subjectId: subject.id,
      amount: Number(amount)
    });

    if (!result.ok) {
      Alert.alert(
        'Reference flagged',
        `Reference looks suspicious: ${result.issues.join(', ')}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              await submitManualPaymentPending(
                user.id,
                subject.id,
                subject.name,
                Number(amount),
                reference.trim()
              );
              Alert.alert('Pending', 'Payment recorded and is pending verification.');
              navigation.popToTop();
            }
          }
        ]
      );
      setLoading(false);
      return;
    }

    // If clean → normal flow
    await submitManualPaymentPending(
      user.id,
      subject.id,
      subject.name,
      Number(amount),
      reference.trim()
    );
    Alert.alert('Pending', 'Payment recorded and is pending verification.');
    navigation.popToTop();

  } catch (err) {
    Alert.alert('Error', err.message || 'Could not submit payment.');
  } finally {
    setLoading(false);
  }
};



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
        Manual Payment
      </Text>

      {/* ================= BANK DETAILS ================= */}
      <View style={styles.box}>
        <Text style={styles.subHeader}>
          Transfer to:
        </Text>

        <Text style={styles.bankDetails}>
          Bank: Zenith Bank
        </Text>

        <Text style={styles.bankDetails}>
          Account Name: EduBox Academy
        </Text>

        <Text style={styles.bankDetails}>
          Account Number: 0123456789
        </Text>
      </View>

      {/* ================= REFERENCE ================= */}
      <TextInput
        value={typeof reference === 'string' ? reference : ''}
        onChangeText={(t) => {
          if (typeof setReference === 'function') {
            setReference(String(t).toUpperCase());
          }
        }}
        placeholder="Enter Reference (Example: EDU-93JH-7HD2)"
        style={styles.input}
        autoCapitalize="characters"
      />

      {/* ================= AMOUNT ================= */}
      <TextInput
        value={typeof amount === 'string' ? amount : ''}
        onChangeText={(t) => {
          if (typeof setAmount === 'function') {
            setAmount(t);
          }
        }}
        placeholder="Amount"
        keyboardType="numeric"
        style={styles.input}
      />

      {/* ================= SUBMIT ================= */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          if (typeof handleConfirm === 'function') {
            handleConfirm();
          }
        }}
        disabled={loading === true}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>
          {loading ? 'Saving...' : 'Record Payment'}
        </Text>
      </TouchableOpacity>
    </View>
  );

}

const styles = StyleSheet.create({
  container:{flex:1, padding:20},
  backBtn: { marginBottom: 15, width: 35 },
  title:{fontSize:22,fontWeight:'700', color:'#001F54', marginBottom:20},
  subHeader:{fontWeight:'700', marginBottom:20, fontSize: 15},
  box:{backgroundColor:'#f0f4ff', padding:14, borderRadius:10, marginBottom:20},
  input:{borderWidth:1,borderColor:'#ccc',padding:14,borderRadius:8, marginBottom:20, fontSize:16},
  btn:{backgroundColor:'#001F54', padding:15, borderRadius:10},
  bankDetails:{marginBottom:8, fontSize:16}
});
