import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../utils/dbHelper';
import { AuthContext } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('❌ Error', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const user = await loginUser(email.trim(), password);

      if (!user) {
        Alert.alert('❌ Login Failed', 'Invalid email or password.');
        return;
      }

      await AsyncStorage.multiSet([
        ['current_user', JSON.stringify(user)],
      ]);

      await login(user);

      Platform.OS === 'android'
        ? ToastAndroid.show('✅ Login Successful', ToastAndroid.SHORT)
        : Alert.alert('✅ Login Successful');
    } catch (e) {
      Alert.alert('❌ Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back!</Text>

      <Image
        source={require('../../assets/images/logo.jpeg')}
        style={styles.logo}
      />

      {/* EMAIL */}
      <TextInput
        placeholder="Email"
        placeholderTextColor="#9AA3AF"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {/* PASSWORD */}
      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="#9AA3AF"
          style={styles.passwordInput}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eye}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>


      <View style={{ marginBottom: 20 }}>
        <Button
          title={loading ? 'Logging in...' : 'Login'}
          color="#001F54"
          onPress={handleLogin}
          disabled={loading}
        />
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Forgot Password?</Text>
      </TouchableOpacity>

      <Text style={styles.text}>Don’t have an account?</Text>

      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => navigation.replace('Register')}
      >
        <Text style={styles.outlineText}>REGISTER</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;

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
    paddingHorizontal: 12,
    marginBottom: 15,
  },

  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 10,
  },

  eye: {
    marginLeft: 8,
  },

  eyeText: {
    fontSize: 18,
  },
  link: { color: '#001F54', textAlign: 'center', marginVertical: 15 },
  text: { textAlign: 'center', color: '#001F54', fontSize: 16 },
  outlineButton: {
    borderWidth: 2,
    borderColor: '#001F54',
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 10,
  },
  outlineText: { color: '#001F54', textAlign: 'center', fontWeight: 'bold'},
});
  