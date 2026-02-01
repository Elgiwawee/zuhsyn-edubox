// src/screens/ProfileScreen.js
import React, { useEffect, useState,useContext } from 'react';
import {
  View, Text, TextInput, StyleSheet, Image, TouchableOpacity, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation,} from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import HeaderTitle from '../components/HeaderTitle';
import {
  getCurrentUser,
  updateUserProfile,
  updateUserPassword,
  verifyUserPasswordByEmail,
} from '../utils/dbHelper';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { logout } = useContext(AuthContext);

  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const u = await getCurrentUser();
      if (!u) {
        return;
      }

      setUser(u);
      setName(u.name || '');
      setPhone(u.phone || '');
    };
    loadUser();
  }, []);

  const handleUpdate = async () => {
    if (!user) return;

    const wantsPasswordChange =
      oldPassword || newPassword || confirmPassword;

    if (wantsPasswordChange) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        Alert.alert('Error', 'Fill all password fields');
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }

      const ok = await verifyUserPasswordByEmail(user.email, oldPassword);
      if (!ok) {
        Alert.alert('Error', 'Old password is incorrect');
        return;
      }
    }

    try {
      await updateUserProfile(user.id, name);

      if (wantsPasswordChange) {
        await updateUserPassword(user.id, newPassword);
        await logout(); // 🔥 ONLY THIS

        Alert.alert(
          'Success',
          'Password updated. Please login again.'
        );
        return;
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Update Failed', 'Something went wrong');
    }
  };


  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <HeaderTitle />
        </View>
      </View>

      <Text style={styles.screenTitle}>Profile</Text>

      <Image
        source={require('../../assets/images/default_avatar.jpg')}
        style={styles.logo}
      />

      <TextInput
        placeholder="Full Name"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TextInput
        placeholderTextColor="#6B7280"
        value={user.email}
        editable={false}
        style={[styles.input, styles.readOnly]}
      />

      <Text style={styles.section}>Change Password</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Old Password"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showOld}
          value={oldPassword}
          onChangeText={setOldPassword}
          style={styles.passwordInput}
        />
        <TouchableOpacity onPress={() => setShowOld(!showOld)}>
          <Icon
            name={showOld ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>


      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="New Password"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showNew}
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.passwordInput}
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
          placeholder="Confirm New Password"
          placeholderTextColor="#6B7280"
          secureTextEntry={!showConfirm}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.passwordInput}
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
          <Icon
            name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleUpdate}>
        <Text style={styles.buttonText}>Update Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#001F54',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 20,
  },
  headerTitleWrap: {
    marginLeft: 10,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#001F54',
    marginBottom: 20,
    marginLeft: 5,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 25,
    borderRadius: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#001F54',
    padding: 10,
    marginBottom: 15,
    borderRadius: 10,
    fontSize: 15,
    color: '#111827', 
  },
  section: {
    fontWeight: 'bold',
    fontSize: 16,
    marginVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#001F54',
  },
  button: {
    backgroundColor: '#001F54',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputWrapper: {
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

});
