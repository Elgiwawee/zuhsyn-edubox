import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { setAdminPin } from '../../utils/dbHelper';
import { AuthContext } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AdminHeader from '../../components/AdminHeader';

export default function AdminSetPinScreen() {
  const [pin, setPin] = useState('');
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();

  const handleSet = async () => {
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits');
      return;
    }

    try {
      await setAdminPin(user.id, pin);
      Alert.alert('Success', 'Admin PIN set successfully');

      // ✅ YES — this should redirect to admin
      navigation.replace('AdminDashboard');
    } catch (err) {
      Alert.alert('Error', 'Failed to set PIN');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* HEADER */}
        <AdminHeader title="Create Admin PIN" />

        {/* BACK BUTTON */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={28} color="#001F54" />
        </TouchableOpacity>

        {/* TITLE */}
        <Text style={styles.title}>Create Admin PIN</Text>

        {/* SUBTITLE */}
        <Text style={styles.subtitle}>
          This PIN protects access to the Admin Dashboard.
        </Text>

        {/* INPUT */}
        <TextInput
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          value={pin}
          onChangeText={setPin}
          style={styles.input}
          placeholder="Enter new PIN"
          placeholderTextColor="#999"
        />

        {/* BUTTON */}
        <TouchableOpacity onPress={handleSet} style={styles.btn}>
          <Text style={styles.btnText}>Save PIN</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  container: {
    flex: 1,
    padding: 22,
  },
  backBtn: {
    marginVertical: 10,
    width: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#001F54',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#4a4a4a',
    marginBottom: 25,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccd3e0',
    padding: 14,
    borderRadius: 10,
    fontSize: 18,
    letterSpacing: 3,
    textAlign: 'center',
    backgroundColor: '#fff',
    marginBottom: 18,
  },
  btn: {
    backgroundColor: '#009688',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  btnText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
});
