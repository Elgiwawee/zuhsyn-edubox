import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { createUser, getUserByEmail } from '../utils/dbHelper';
import Icon from 'react-native-vector-icons/Ionicons';

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  

  const handleRegister = async () => {
    if (!name || !email || !password1 || !password2) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password1 !== password2) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const exists = await getUserByEmail(email.trim());
    if (exists) {
      Alert.alert('Error', 'Email already registered');
      return;
    }

    await createUser(name.trim(), email.trim(), password1);
    Alert.alert('✅ Success', 'Registration complete');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <Image source={require('../../assets/images/logo.jpeg')} style={styles.logo} />

      <TextInput
        placeholder="Full Name"
        placeholderTextColor="#9AA3AF"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#9AA3AF"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      {/* PASSWORD */}
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="#9AA3AF"
          secureTextEntry={!show}
          style={styles.passwordInput}
          value={password1}
          onChangeText={setPassword1}
        />
        <TouchableOpacity
          onPress={() => setShow(!show)}
          style={styles.eye}
        >
          <Icon
            name={show ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>


      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Confirm password"
          placeholderTextColor="#9AA3AF"
          secureTextEntry={!showConfirm}
          style={styles.passwordInput}
          value={password2}
          onChangeText={setPassword2}
        />
        <TouchableOpacity
          onPress={() => setShowConfirm(!showConfirm)}
          style={styles.eye}
        >
          <Icon
            name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
        <Text style={styles.primaryText}>REGISTER</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.replace('Login')}>
        <Text style={styles.link}>Already have an account? LOGIN</Text>
      </TouchableOpacity>
    </View>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#001F54', textAlign: 'center', marginBottom: 20 },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 20, borderRadius: 60 },
  input: {
    borderWidth: 1,
    borderColor: '#001F54',
    color: '#111827',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#001F54',
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 50,
  },

  passwordInput: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
  },

  eye: {
    paddingLeft: 10,
  },


  primaryButton: {
    backgroundColor: '#001F54',
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 10,
  },
  primaryText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  link: { color: '#001F54', textAlign: 'center', marginTop: 15 },
});
