// context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDB } from '../utils/database';
import { logoutUser as dbLogoutUser } from '../utils/dbHelper';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // LOAD USER ON APP START
  useEffect(() => {
    const loadUser = async () => {
      try {
        await initDB();
        const savedUser = await AsyncStorage.getItem('user');

        if (savedUser) {
          setUser(JSON.parse(savedUser));
          console.log('🔐 User loaded');
        } else {
          setUser(null);
          console.log('🚪 No saved user');
        }
      } catch (err) {
        console.error('❌ Auth load error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // LOGIN
  const login = async (userData) => {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    console.log('✅ Logged in');
  };

  // LOGOUT (🔥 THIS IS THE MAGIC)
  const logout = async () => {
    try {
      await dbLogoutUser(); // update DB
      await AsyncStorage.removeItem('user'); // clear storage
      setUser(null); // 🔥 THIS SWITCHES NAVIGATOR
      console.log('🚪 Logged out');
    } catch (err) {
      console.error('❌ Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
