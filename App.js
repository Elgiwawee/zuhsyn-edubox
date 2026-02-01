import 'react-native-gesture-handler';
import React, { useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { initDB } from './src/utils/database';
import { seedInitialData } from './src/utils/dbHelper';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import AdminStack from './src/navigation/AdminStack';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import BootstrapGate from './src/bootstrap/BootstrapGate';
import './src/polyfills/findLast';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SubjectsScreen from './src/screens/SubjectsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderBoardScreen from './src/screens/LeaderBoardScreen';
import AboutCompanyScreen from './src/screens/AboutCompanyScreen';
import EnglishSubjectScreen from './src/screens/EnglishSubjectScreen';
import EnglishLessonDetailScreen from './src/screens/EnglishLessonDetailScreen';
import MathsSubjectScreen from './src/screens/MathsSubjectScreen';
import MathsLessonDetailScreen from './src/screens/MathsLessonDetailScreen';
import PhysicsSubjectScreen from './src/screens/PhysicsSubjectScreen';
import PhysicsLessonDetailScreen from './src/screens/PhysicsLessonDetailScreen';
import ChemistrySubjectScreen from './src/screens/ChemistrySubjectScreen';
import ChemistryLessonDetailScreen from './src/screens/ChemistryLessonDetailScreen';
import BiologySubjectScreen from './src/screens/BiologySubjectScreen';
import BiologyLessonDetailScreen from './src/screens/BiologyLessonDetailScreen';
import AgricSubjectScreen from './src/screens/AgricSubjectScreen';
import AgricLessonDetailScreen from './src/screens/AgricLessonDetailScreen';
import OfflineCodeScreen from './src/screens/OfflineCodeScreen';
import ManualPaymentScreen from './src/screens/ManualPaymentScreen';
import OnlinePaymentHelper from './src/screens/OnlinePaymentHelper';
import PaymentMethodScreen from './src/screens/PaymentMethodScreen';
import EnrollmentScreen from './src/screens/EnrollmentScreen';
import AgricGameScreen from './src/screens/AgricGameScreen';
import GameShopScreen from './src/screens/GameShopScreen';
import SkinPreviewScreen from './src/screens/SkinPreviewScreen';
import ChemistryGameScreen from './src/screens/ChemistryGameScreen';
import BiologyGameScreen from './src/screens/BiologyGameScreen';
import EnglishGameScreen from './src/screens/EnglishGameScreen';
import MathsGameScreen from './src/screens/MathsGameScreen';
import PhysicsGameScreen from './src/screens/PhysicsGameScreen';


const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      
      {/* Menu items */}
      <View style={{ flex: 1 }}>
        <DrawerItemList {...props} />
      </View>

      {/* Close button */}
      <TouchableOpacity
        onPress={() => props.navigation.closeDrawer()}
        style={{
          padding: 20,
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <Text
          style={{
            color: 'red',
            fontSize: 16,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          Close ✕
        </Text>
      </TouchableOpacity>

    </DrawerContentScrollView>
  );
};

/* ---------------- DRAWER NAVIGATOR ---------------- */
const DrawerNavigator = () => (
  <Drawer.Navigator
    initialRouteName="Dashboard"
    drawerContent={(props) => <CustomDrawerContent {...props} />}
    screenOptions={{
      headerShown: false,
      drawerStyle: { backgroundColor: '#001F54' },
      drawerLabelStyle: { color: '#fff' },
    }}
  >

    <Drawer.Screen name="Dashboard" component={DashboardScreen} />
    <Drawer.Screen name="Subjects" component={SubjectsScreen} />
    <Drawer.Screen name="Profile" component={ProfileScreen} />
    <Drawer.Screen name="LeaderBoard" component={LeaderBoardScreen} />
    <Drawer.Screen name="AboutCompany" component={AboutCompanyScreen} />
  </Drawer.Navigator>
);


/* ---------------- AUTH STACK ---------------- */
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    <Stack.Screen name="AboutCompany" component={AboutCompanyScreen} />
  </Stack.Navigator>
);

/* ---------------- APP STACK (FOR LOGGED-IN USERS) ---------------- */
const AppStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainDrawer" component={DrawerNavigator} />
    <Stack.Screen name="EnglishSubject" component={EnglishSubjectScreen} />
    <Stack.Screen name="EnglishLessonDetail" component={EnglishLessonDetailScreen} />
    <Stack.Screen name="MathsSubject" component={MathsSubjectScreen} />
    <Stack.Screen name="MathsLessonDetail" component={MathsLessonDetailScreen} />
    <Stack.Screen name="PhysicsSubject" component={PhysicsSubjectScreen} />
    <Stack.Screen name="PhysicsLessonDetail" component={PhysicsLessonDetailScreen} />
    <Stack.Screen name="ChemistrySubject" component={ChemistrySubjectScreen} />
    <Stack.Screen name="ChemistryLessonDetail" component={ChemistryLessonDetailScreen} />
    <Stack.Screen name="BiologySubject" component={BiologySubjectScreen} />
    <Stack.Screen name="BiologyLessonDetail" component={BiologyLessonDetailScreen} />
    <Stack.Screen name="AgricSubject" component={AgricSubjectScreen} />
    <Stack.Screen name="AgricLessonDetail" component={AgricLessonDetailScreen} />
    <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
    <Stack.Screen name="OfflineCode" component={OfflineCodeScreen} />
    <Stack.Screen name="ManualPayment" component={ManualPaymentScreen} />
    <Stack.Screen name="OnlinePaymentHelper" component={OnlinePaymentHelper} />
    <Stack.Screen name="Enrollment" component={EnrollmentScreen} />
    <Stack.Screen name="AgricGame" component={AgricGameScreen} options={{ headerShown: false }} />
    <Stack.Screen name="GameShop" component={GameShopScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SkinPreview" component={SkinPreviewScreen} options={{ headerShown: false }} />
    <Stack.Screen name ="ChemistryGame" component={ChemistryGameScreen} options={{ headerShown: false}} />
    <Stack.Screen name ="BiologyGame" component={BiologyGameScreen} options={{ headerShown: false}} />
    <Stack.Screen name ="EnglishGame" component={EnglishGameScreen} options={{ headerShown: false}} />
    <Stack.Screen name ="MathsGame" component={MathsGameScreen} options={{ headerShown: false}} />
    <Stack.Screen name ="PhysicsGame" component={PhysicsGameScreen} options={{ headerShown: false}} />
  </Stack.Navigator>
);


/* ---------------- NAVIGATION WRAPPER ---------------- */
const RootNavigator = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>

      {!user && <AuthStack />}

      {user && user.role !== 'admin' && <AppStack />}

      {user && user.role === 'admin' && <AdminStack />}

    </NavigationContainer>
  );
};


/* ---------------- MAIN APP COMPONENT ---------------- */
const App = () => {
  React.useEffect(() => {
    const setup = async () => {
      await initDB();
      await seedInitialData();
    };
    setup();
  }, []);

  return (
    <AuthProvider>
      <AppErrorBoundary>
       <BootstrapGate>
        <RootNavigator />
       </BootstrapGate>
      </AppErrorBoundary>
    </AuthProvider>
  );
};

export default App;

