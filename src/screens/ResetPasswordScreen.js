import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ToastAndroid,
} from 'react-native';
import {
  updateUserPassword,
  logoutUser,
  getUserById,
  hashPassword,
  getUserByEmail,
} from '../utils/dbHelper';
import Icon from 'react-native-vector-icons/Ionicons';


const ResetPasswordScreen = ({ route, navigation }) => {
  const { userId, email, fromForgot } = route.params || {};

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const showToast = (msg) =>
    Platform.OS === 'android'
      ? ToastAndroid.show(msg, ToastAndroid.SHORT)
      : Alert.alert(msg);

  const handleReset = async () => {
  if (!fromForgot && !oldPassword) {
    Alert.alert('Error', 'Please enter current password');
    return;
  }

  if (!newPassword || !confirmPassword) {
    Alert.alert('Error', 'Please fill all fields');
    return;
  }

  if (newPassword !== confirmPassword) {
    Alert.alert('Error', 'Passwords do not match');
    return;
  }

  setLoading(true);

  try {
    // -------- VERIFY OLD PASSWORD (IF LOGGED IN) --------
    if (!fromForgot) {
      const user = await getUserByEmail(email);
      if (!user) {
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }

      const oldHash = hashPassword(oldPassword);
      if (oldHash !== user.password) {
        Alert.alert('Error', 'Current password incorrect');
        setLoading(false);
        return;
      }
    }

    // -------- UPDATE PASSWORD (HASHED) --------
    await updateUserPassword(userId, newPassword);

    // -------- LOGOUT FOR SECURITY --------
    await logoutUser();

    showToast('✅ Password updated. Please login again.');
    navigation.replace('Login');

  } catch (err) {
    console.error('Reset password error:', err);
    Alert.alert('Error', 'Could not reset password');
  } finally {
    setLoading(false);
  }
};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.sub}>{email}</Text>

      {!fromForgot && (
        <View style={styles.inputWrapper}>
          <TextInput
            placeholder="Current password"
            placeholderTextColor="#9AA3AF"
            secureTextEntry={!showOld}
            style={styles.input}
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <TouchableOpacity onPress={() => setShowOld(!showOld)}>
            <Icon
              name={showOld ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>
      )}


      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="New password"
          placeholderTextColor="#9AA3AF"
          secureTextEntry={!showNew}
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TouchableOpacity onPress={() => setShowNew(!showNew)}>
          <Icon
            name={showNew ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>


      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Confirm new password"
          placeholderTextColor="#9AA3AF"
          secureTextEntry={!showConfirm}
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
          <Icon
            name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>


      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={handleReset}
        disabled={loading}
      >
        <Text style={styles.primaryText}>
          {loading ? 'Updating...' : 'UPDATE PASSWORD'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#001F54' },
  sub: { textAlign: 'center', marginBottom: 20, color: '#444' },
  input: {
    padding: 12,
    borderRadius: 6,
    color: '#111827',
  },
  primaryBtn: {
    backgroundColor: '#001F54',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: 'bold' },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#111827',
  },

});
