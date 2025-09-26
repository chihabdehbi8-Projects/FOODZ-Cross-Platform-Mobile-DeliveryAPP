import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import SignUpScreen from './screens/SignUpScreen';
import ResturantMenuScreen from './screens/ResturantMenuScreen';
import { UserProvider } from './UserContext';
import AdminHome from './screens/AdminHome';
import AdminResturantMenu from './screens/AdminResturantMenu';
import AddNewResturant from './screens/AddNewResturant';
import OrderDetailsClient from './screens/OrderDetailsClient';
import DriverHome from './screens/DriverHome';
import DriverActiverOrder from './screens/DriverActiverOrder';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Stack = createNativeStackNavigator();

function App() {

  return (
    <UserProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={'Login'} screenOptions={{ gestureEnabled: false }}>
            <Stack.Screen options={{ headerShown: false }} name="Login" component={LoginScreen} />
            <Stack.Screen options={{ headerShown: false }} name="Home" component={HomeScreen} />
            <Stack.Screen options={{ headerShown: false }} name="SignUp" component={SignUpScreen} />
            <Stack.Screen options={{ headerShown: false }} name="Menu" component={ResturantMenuScreen} />
            <Stack.Screen options={{ headerShown: false }} name="AdminHome" component={AdminHome} />
            <Stack.Screen options={{ headerShown: false }} name="AdminRMenu" component={AdminResturantMenu} />
            <Stack.Screen options={{ headerShown: false }} name="AddNewRes" component={AddNewResturant} />
            <Stack.Screen options={{ headerShown: false }} name="OrderDetails" component={OrderDetailsClient} />
            <Stack.Screen options={{ headerShown: false }} name="DriverHome" component={DriverHome} />
            <Stack.Screen options={{ headerShown: false }} name="DriverActiveOrder" component={DriverActiverOrder} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
