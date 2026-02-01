import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../context/AuthContext';
import { View, Text } from 'react-native';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminPaymentsScreen from '../screens/admin/AdminPaymentsScreen';
import AdminGenerateCodesScreen from '../screens/admin/AdminGenerateCodesScreen';
import AdminPinScreen from '../screens/admin/AdminPinScreen';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminSetPinScreen from '../screens/admin/AdminSetPinScreen';

const Stack = createStackNavigator();

export default function AdminStack() {
  const { user } = useContext(AuthContext);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
      {/* Admin PIN must always be accessible */}
      <Stack.Screen name="AdminSetPin" component={AdminSetPinScreen} />
      <Stack.Screen name="AdminPin" component={AdminPinScreen} />

      {/* Only allow these if user is admin */}
      {user?.role === "admin" && (
        <>
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="AdminPayments" component={AdminPaymentsScreen} />
          <Stack.Screen name="AdminGenerateCodes" component={AdminGenerateCodesScreen} />
          <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
        </>
      )}

    </Stack.Navigator>
  );
}
