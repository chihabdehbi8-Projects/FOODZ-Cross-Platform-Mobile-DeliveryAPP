import { Image, KeyboardAvoidingView, StyleSheet, Text, TextInput, View, SafeAreaView, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { auth } from '../firebase.js';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loading1, setLoading1] = useState(false);
    const navigation = useNavigation();

    const handleFocus = () => {
        if (!phoneNumber.startsWith('+213')) {
            setPhoneNumber('+213');
        }
    };

    const handleChangeText = (text) => {
        if (text.length <= 13) {
            setPhoneNumber(text);
        }
    };

    // Function to navigate based on role
    const navigateBasedOnRole = async (user) => {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const role = userData.role;

            let routeName;
            if (role === 'Client') {
                routeName = 'Home';
            } else if (role === 'Admin') {
                routeName = 'AdminHome';
            } else if (role === 'Driver') {
                routeName = 'DriverHome';
            }

            if (routeName) {
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: routeName }],
                    })
                );
            }
        }
    };

    // Check AsyncStorage on app load for user data
    useEffect(() => {
        const checkUserSession = async () => {
            setLoading1(true);
            const storedUser = await AsyncStorage.getItem('user');

            if (storedUser) {
                const user = JSON.parse(storedUser);
                const { email, password } = user;
    
                if (email && password) {
                    try {
                        // Attempt to sign in the user using email and password from AsyncStorage
                        const userCredential = await signInWithEmailAndPassword(auth, email, password);
                        const loggedInUser = userCredential.user;
    
                        // Navigate based on the role of the logged-in user
                        navigateBasedOnRole(loggedInUser);
                    } catch (error) {
                        console.error('Error signing in user from AsyncStorage:', error);
                    }
                } else {
                    console.log('Stored user data is missing email or password');
                }
            } else {
                setLoading1(false);
                console.log('No user data found in AsyncStorage');
            }
    
            
        };
    
        checkUserSession();
    }, []);
    

    const handleLogin = async () => {
        setLoading(true);
        const email = `${phoneNumber}@example.com`;
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await AsyncStorage.setItem('user', JSON.stringify({ email, password }));
            navigateBasedOnRole(user);
        } catch (error) {
            setLoading(false);
            alert('Wrong email or password');
        }
    };
    

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FEC635" />
                <Text style={styles.loadingText}>Logging in...</Text>
            </SafeAreaView>
        );
    }
    if (loading1) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FEC635" />
                <Text style={styles.loadingText}>Almost there...</Text>
            </SafeAreaView>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior='padding'>
            <View style={styles.innerContainer}>
                <View style={styles.logoContainer}>
                    <Image
                        style={styles.logoP}
                        source={require('../assets/Plogo.png')}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        placeholder='Phone number'
                        value={phoneNumber}
                        onChangeText={text => setPhoneNumber(text)}
                        onFocus={handleFocus}
                        style={styles.input}
                        maxLength={13}
                        keyboardType="numeric"
                    />
                    <TextInput
                        placeholder='Password'
                        value={password}
                        onChangeText={text => setPassword(text)}
                        style={styles.input}
                        secureTextEntry
                    />
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        onPress={handleLogin}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Login</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('SignUp')}
                        style={[styles.button, styles.buttonOutline]}
                    >
                        <Text style={styles.buttonOutlineText}>Register</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    innerContainer: {
        width: '100%',
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logoP: {
        width: '60%',
        height: undefined,
        aspectRatio: 1,
        resizeMode: 'contain',
    },
    inputContainer: {
        width: '100%',
        alignItems: 'center',
    },
    input: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 10,
        width: '80%',
    },
    buttonContainer: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 30,
    },
    button: {
        backgroundColor: '#FEC635',
        width: 210,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonOutline: {
        backgroundColor: 'white',
        marginTop: 10,
        borderColor: '#FEC635',
        borderWidth: 2,
    },
    buttonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },
    buttonOutlineText: {
        color: '#FEC635',
        fontWeight: '700',
        fontSize: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 18,
        color: '#555',
    },
});
