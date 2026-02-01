// screens/OnlinePaymentHelper.js
import React, { useState } from 'react';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, Text, TouchableOpacity, Linking, TextInput, Alert, StyleSheet } from 'react-native';
import { createOnlinePaymentRecord,submitOnlinePaymentPending,validatePaymentReference, getCurrentUser } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';


export default function OnlinePaymentHelper({ route, navigation }) {
  const { subject } = route.params;
  const [reference, setReference] = useState('');

  const openBrowser = () => {
    // open your preferred payment page (example: Paystack payment page)
    // For offline-first, user will pay in browser and copy the reference. This is optional.
    const url = 'https://paystack.com/pay/YOUR_PAYMENT_LINK'; // placeholder
    Linking.openURL(url).catch((e) => Alert.alert('Error', 'Cannot open browser'));
  };

  const handleSubmitRef = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) { Alert.alert('Login required'); return; }
    if (!reference.trim()) { Alert.alert('Enter reference'); return; }

    // 🔍 NEW PART (validate reference)
    const result = await validatePaymentReference(reference.trim(), {
      userId: user.id,
      subjectId: subject.id,
      amount: Number(subject.price)
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
              await submitOnlinePaymentPending(
                user.id,
                subject.id,
                subject.name,
                Number(subject.price),
                reference.trim()
              );
              Alert.alert('Pending', 'Payment recorded and awaiting admin verification.');
              navigation.popToTop();
            }
          }
        ]
      );
      return;
    }

    // If clean → submit normally
    await submitOnlinePaymentPending(
      user.id,
      subject.id,
      subject.name,
      Number(subject.price),
      reference.trim()
    );

    Alert.alert('Pending', 'Payment recorded. It will be verified by admin soon.');
    navigation.popToTop();

  } catch (err) {
    Alert.alert('Error', err.message || 'Could not record online payment.');
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
        Pay online (optional)
      </Text>

      {/* ================= DESCRIPTION ================= */}
      <Text style={styles.text}>
        We will open the payment page in your browser. After payment copy the
        transaction reference and paste it below to unlock your subject offline.
      </Text>

      {/* ================= OPEN BROWSER ================= */}
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => {
          if (typeof openBrowser === 'function') {
            openBrowser();
          }
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>
          Click to open payment page (browser)
        </Text>
      </TouchableOpacity>

      {/* ================= REFERENCE INPUT ================= */}
      <TextInput
        placeholder="Paste transaction reference"
        value={typeof reference === 'string' ? reference : ''}
        onChangeText={(t) => {
          if (typeof setReference === 'function') {
            setReference(String(t));
          }
        }}
        style={styles.input}
      />

      {/* ================= SUBMIT ================= */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          if (typeof handleSubmitRef === 'function') {
            handleSubmitRef();
          }
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>
          Submit Reference & Unlock
        </Text>
      </TouchableOpacity>
    </View>
  );

}

const styles = StyleSheet.create({
  container:{flex:1,padding:20},
  title:{fontSize:22,fontWeight:'700', marginBottom:10},
  btnPrimary:{backgroundColor:'#00C851', padding:12, borderRadius:10, marginBottom:20},
  btn:{backgroundColor:'#001F54', padding:15, borderRadius:15, marginBottom:30},
  input:{borderWidth:1,borderColor:'#ddd', padding:12, borderRadius:8, marginBottom:12},
  text:{marginBottom:10, fontSize:18, color:'#333'}
});
