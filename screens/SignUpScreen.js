import React, { useState, useEffect,useRef } from 'react';
import { View, TextInput, Dimensions, Alert,Platform, StyleSheet, KeyboardAvoidingView,SafeAreaView,ActivityIndicator, Image, Animated, TouchableOpacity, Text, Modal } from 'react-native';
import {createUserWithEmailAndPassword} from 'firebase/auth';
import { auth, db } from '../firebase';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const SignUpScreen = () => {
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [password, setPassword] = useState('');
    const [isOtpInputModalVisible, setIsOtpInputModalVisible] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const strengthBarWidth = useState(new Animated.Value(0))[0];
    const [passwordStrength, setPasswordStrength] = useState(0);
    const db = getFirestore();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');

    const sendVerificationCode = async () => {
    
        if (password !== confirmPassword) {
            alert("Passwords don't match!");
            return;
        }
        try{
        const code = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit code
        setGeneratedCode(code);
        console.log(code);
        const raw = JSON.stringify({
            messages: [
                {
                    destinations: [{ to: phoneNumber }],
                    from: "ServiceSMS", // Replace with your sender ID
                    text: `Your Foodz app verification code is: ${code}`,
                },
            ],
        });

        const myHeaders = new Headers();
        myHeaders.append("Authorization", "App 051f15e5b666c0bae5e18291bf180149-32c226f8-a128-414a-8a0f-10eb66719e98");
 // Replace with your Infobip API key
        myHeaders.append("Content-Type", "application/json");
        myHeaders.append("Accept", "application/json");

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
        };

        try {
            const response = await fetch("https://api.infobip.com/sms/2/text/advanced", requestOptions);
            const result = await response.json();
            if (response.ok) {
                Alert.alert("Success", "Verification code sent!");
                setIsOtpInputModalVisible(true);
            } else {
                Alert.alert("Error", result.message || "Failed to send verification code.");
            }
        } catch (error) {
            console.error("Error:", error);
            Alert.alert("Error", "An error occurred while sending the verification code.");
        }
    }
    catch (error) {
        alert(error.message);
    }
};

    const verifyCode = () => {
        if (verificationCode === generatedCode) {
            Alert.alert("Success", "Phone number verified!");
            handleSignUp();
            setIsOtpInputModalVisible(false);
        } else {
            Alert.alert("Error", "Invalid verification code.");
        }
    };

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
      
    const evaluatePasswordStrength = (input) => {
        setPassword(input);
        let strength = 0;

        if (input.length >= 6) strength++;
        if (/[A-Za-z]/.test(input)) strength++;
        if (/\d/.test(input)) strength++;

        setPasswordStrength(strength);
        Animated.timing(strengthBarWidth, {
            toValue: getStrengthPercentage(strength),
            duration: 300,
            useNativeDriver: false,
        }).start();
    };

    const getStrengthPercentage = (strength) => {
        switch (strength) {
            case 0: return 0; 
            case 1: return 25; 
            case 2: return 50; 
            case 3: return 75; 
            case 4: return 100; 
            default: return 0; 
        }
    };

    const getStrengthColor = () => {
        switch (passwordStrength) {
            case 0: return 'red';
            case 1: return '#FFA07A'; 
            case 2: return 'yellow';
            case 3: return '#90EE90'; 
            case 4: return 'green';
            default: return 'red';
        }
    };

    const handleSignUp = async () => {
        if (password !== confirmPassword) {
            alert("Passwords don't match!");
            return;
        }
    
        const email = `${phoneNumber}@example.com`;
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
    
            // Store user in AsyncStorage
            await AsyncStorage.setItem('user', JSON.stringify({ email, password }));
    
            // Add user details to Firestore
            await setDoc(doc(db, "users", auth.currentUser.uid), {
                name,
                surname,
                phoneNumber,
                email: user.email,
                role: "Client",
            });
            navigation.navigate('Home');
            setLoading(false);
        } catch (error) {
            alert(error.message);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FEC635" />
                <Text style={styles.loadingText}>Signin up...</Text>
            </SafeAreaView>
        );
    }
    return (
        <KeyboardAvoidingView style={styles.container} behavior='padding'>
            
        <View style={styles.inputContainer}>
            <View style={styles.logoContainer}>
                <Image style={styles.logoP} source={require('../assets/Plogo.png')} />
            </View>
                <View style={styles.inputContainer}>
                    <TextInput placeholder='Name' value={name} onChangeText={setName} style={styles.input} />
                    <TextInput placeholder='Surname' value={surname} onChangeText={setSurname} style={styles.input} />
                    <TextInput 
                        placeholder='Phone Number' 
                        value={phoneNumber} 
                        onChangeText={setPhoneNumber}
                        onFocus={handleFocus} 
                        style={styles.input} 
                        maxLength={13} 
                        keyboardType="numeric" 
                    />
                     <TextInput 
                        placeholder="Password" 
                        value={password} 
                        onChangeText={evaluatePasswordStrength} 
                        onFocus={() => setIsPasswordFocused(true)} 
                        onBlur={() => {
                            setIsPasswordFocused(false);
                            setPasswordStrength(0);
                            Animated.timing(strengthBarWidth, { toValue: 0, duration: 300, useNativeDriver: false }).start();
                        }} 
                        style={styles.input} 
                        secureTextEntry 
                    />
                    {isPasswordFocused && (
                        <View style={styles.strengthContainer}>
                            <Animated.View
                                style={[
                                    styles.strengthBar,
                                    {
                                        width: strengthBarWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                                        backgroundColor: getStrengthColor(),
                                    },
                                ]}
                            />
                        </View>
                    )}
                    <TextInput 
                        placeholder='Confirm Password' 
                        value={confirmPassword} 
                        onChangeText={setConfirmPassword} 
                        style={styles.input} 
                        secureTextEntry 
                    />
                </View>
            
            <View style={styles.buttonContainer}>
                <TouchableOpacity onPress={() => {sendVerificationCode()}} style={styles.button}>
                        <Text style={styles.buttonText}>Sign Up</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={[styles.button, styles.buttonOutline]}>
                    <Text style={styles.buttonOutlineText}>Login</Text>
                </TouchableOpacity>
            </View>
            </View>

            <Modal visible={isOtpInputModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                <View style={styles.PhVerification}>
                    <Text style={styles.PhVerificationTitle}>Enter the code you received:</Text>
                    <TextInput
                        placeholder='Verification Code'
                        value={verificationCode}
                        onChangeText={setVerificationCode}
                        style={styles.inputCode}
                    />
                    <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={() => verifyCode()}>
                        <Text style={styles.buttonText}>Verify</Text>
                    </TouchableOpacity>
                    </View>
                </View>
        </View>
        </Modal>
    </KeyboardAvoidingView>
);
};

export default SignUpScreen;
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20, // Added padding for better spacing
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logoP: {
        width: '60%', // Responsive logo size
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
        marginTop: 5,
        width: '80%', // Responsive input width
    },
    strengthContainer: {
        width: '80%',
        height: 10,
        backgroundColor: '#e0e0df',
        borderRadius: 5,
        marginTop: 5,
        overflow: 'hidden',
    },
    strengthBar: {
        height: '100%',
        borderRadius: 5,
    },
    buttonContainer: {
        width: '60%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 30,
    },
    button: {
        backgroundColor: '#FEC635',
        width: '100%', // Responsive button width
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
    PhVerification: {
        backgroundColor: '#f0f0f0',
        borderRadius: 30,
        padding: 16,
        alignItems: 'center',
        width: Dimensions.get('window').width * 0.90,
        ...(Platform.OS === 'ios' && {
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 5,
        }),
        // Android elevation style
        ...(Platform.OS === 'android' && {
            elevation: 15, // Adjust elevation value as needed
        }),
    },
    PhVerificationTitle: {
        padding: 10,
        fontSize: 20,
        fontWeight: 'bold',
    },
    inputCode: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 5,
        width: '60%',
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
    modalOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
      },
});