// screens/OfflineCodeScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { redeemOfflineCode, getCurrentUser } from '../utils/dbHelper';
import { Show, Render } from '../components/SafeConditional';


export default function OfflineCodeScreen({ route, navigation }) {
  const { subject } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      Alert.alert('Invalid Code', 'Please enter a valid offline code.');
      return;
    }

    setLoading(true);

    try {
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Login required', 'Please login.');
        setLoading(false);
        return;
      }

      const res = await redeemOfflineCode(user.id, code.trim(), subject.id);
      Alert.alert('Success', res.message || 'Code redeemed successfully.');
      navigation.popToTop();

    } catch (err) {
      Alert.alert('Error', err.message || 'Could not redeem code.');
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
        Redeem Offline Code
      </Text>

      {/* ================= INFO ================= */}
      <Text style={styles.info}>
        Example format:{' '}
        <Text style={{ fontWeight: 'bold' }}>
          EDU-1A2B-3C4D
        </Text>
      </Text>

      {/* ================= CODE INPUT ================= */}
      <TextInput
        value={typeof code === 'string' ? code : ''}
        onChangeText={(t) => {
          if (typeof setCode === 'function') {
            setCode(String(t).toUpperCase());
          }
        }}
        style={styles.input}
        placeholder="Enter code"
        autoCapitalize="characters"
      />

      {/* ================= SUBMIT ================= */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          if (typeof handleRedeem === 'function') {
            handleRedeem();
          }
        }}
        disabled={loading === true}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>
          {loading ? 'Processing...' : 'Redeem Code'}
        </Text>
      </TouchableOpacity>

    </View>
  );

}

const styles = StyleSheet.create({
  container: {flex:1, padding:20, marginBottom:20},
  backBtn: { marginBottom: 15, width: 35 },
  title:{fontSize:22,fontWeight:'700', color:'#001F54', marginBottom:15},
  info:{color:'#666', marginBottom:12},
  input:{borderWidth:1,borderColor:'#ccc',padding:14,borderRadius:8, marginBottom:20, fontSize:16},
  btn:{backgroundColor:'#001F54', padding:15, borderRadius:10}
});
