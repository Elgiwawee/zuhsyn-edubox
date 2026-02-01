import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { verifyAdminPin, isAdminPinSet } from '../../utils/dbHelper';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import AdminHeader from '../../components/AdminHeader';

export default function AdminPinScreen() {
  const [pin, setPin] = useState('');
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!user?.id) return;

      const exists = await isAdminPinSet(user.id);

      if (mounted && !exists) {
        navigation.replace('AdminSetPin');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, navigation]);

  const handleVerify = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No admin user found');
      return;
    }

    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits');
      return;
    }

    const ok = await verifyAdminPin(user.id, pin);

    if (ok) {
      navigation.replace('AdminDashboard');
    } else {
      Alert.alert('Invalid PIN', 'PIN is incorrect');
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Admin PIN Verification" />

      <Text style={styles.title}>Enter Admin PIN</Text>

      <TextInput
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="numeric"
        maxLength={6}
        style={styles.input}
        placeholder="Enter PIN"
        placeholderTextColor="#999"
      />

      <TouchableOpacity style={styles.btn} onPress={handleVerify}>
        <Text style={styles.btnText}>Verify</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F7FF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 25,
    marginBottom: 10,
    color: '#001F54',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccd3e0',
    padding: 14,
    borderRadius: 10,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 3,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  btn: {
    backgroundColor: '#001F54',
    padding: 14,
    borderRadius: 10,
    marginTop: 5,
  },
  btnText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
});
