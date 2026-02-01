import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getUserByEmail } from '../utils/dbHelper';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');

  const handleVerifyEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      const user = await getUserByEmail(email.trim());

      if (!user) {
        Alert.alert('Error', 'No account found with this email');
        return;
      }

      // ✅ Navigate with userId
      navigation.replace('ResetPassword', {
        userId: user.id,
        email: user.email,
        fromForgot: true,
      });

    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.info}>
        Enter your email to reset your password
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#9AA3AF"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyEmail}>
        <Text style={styles.primaryText}>VERIFY EMAIL</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#001F54' },
  info: { textAlign: 'center', color: '#444', marginVertical: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    color: '#111827',
  },
  primaryBtn: {
    backgroundColor: '#001F54',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: 'bold' },
  link: { textAlign: 'center', color: '#001F54', marginTop: 20 },
});
