import React, { useEffect, useState, useCallback } from 'react';
import { 
    View, Text, SafeAreaView, StyleSheet, 
    Platform, StatusBar,Modal, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator, TextInput, Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db, secondaryAuth } from '../firebase'; // Adjust the path as necessary
import { collection, getDocs, doc, setDoc, getFirestore, count } from 'firebase/firestore';
import {createUserWithEmailAndPassword } from 'firebase/auth'; 
import { signOut } from 'firebase/auth';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AdminHome = ({ route }) => {
  const [userName, setUserName] = useState('');
  const user = auth.currentUser;
  const navigation = useNavigation();
  const [showRestaurants, setShowRestaurants] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false); // New state for drivers
  const [selectedWilaya, setSelectedWilaya] = useState('All');
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false); // State for loading indicator
  const [restaurantCount, setRestaurantCount] = useState(0);
  const { shouldFetchRestaurants } = route.params || {};
  const wilayas = ['All', 'Tiaret', 'Chlef', 'Tlemcen', 'Oran', 'Alger'];
  const [isModalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const db = getFirestore();

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
  
    // Create a pseudo-email using the phone number
    const email = `${phoneNumber}@example.com`;
    try {
      // Creating the user with the secondary auth instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newDriver = userCredential.user;
  
      // Add user details to Firestore without changing the current user
      await setDoc(doc(db, "users", newDriver.uid), {
        name,
        surname,
        phoneNumber,
        email: newDriver.email,
        role: "Driver",
        status: "offline",
      });
  
      // Show success alert
      alert("Driver account created successfully!");
      setModalVisible(false);
      
      // Optionally, sign out the secondary auth to clear session
      await secondaryAuth.signOut();
  
    } catch (error) {
      alert(error.message);
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

  const handlePressWilaya = (wilaya) => {
    setSelectedWilaya(wilaya);
    fetchRestaurants(wilaya);
  };

  const handleRestaurantClick = () => {
    setShowRestaurants(true);
    setShowDrivers(false); 
    setSelectedWilaya('All');
    fetchRestaurants('All');
  };

  const handleDriversClick = () => {
    setShowDrivers(true);
    setShowRestaurants(false);
  };

  const handleBackToMainView = () => {
    setShowRestaurants(false);
    setShowDrivers(false);
    countRestaurants();
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        setUserName('');
        AsyncStorage.removeItem('user');
        navigation.replace('Login');
      })
      .catch((error) => {
        console.error('Error signing out: ', error);
      });
  };

  const fetchUserData = useCallback(async () => {
    if (user) {
      try {
        const userRef = collection(db, 'users');
        const querySnapshot = await getDocs(userRef);

        querySnapshot.forEach(doc => {
          const userData = doc.data();
          if (userData.email === user.email) {
            setUserName(`${userData.name} ${userData.surname}`);
          }
        });

      } catch (error) {
        console.error('Error fetching user data: ', error);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
    countRestaurants(); // Count restaurants when component mounts
  }, [fetchUserData]);

  const countRestaurants = async () => {
    try {
      let totalCount = 0;
      for (const wilayaName of wilayas.slice(1)) {
        const wilayaDocRef = doc(db, 'Wilayas', wilayaName);
        const restaurantsRef = collection(wilayaDocRef, 'Restaurants');
        const querySnapshot = await getDocs(restaurantsRef);
        totalCount += querySnapshot.size; // Increment the count by the number of documents
      }

      const formattedCount = String(totalCount).padStart(2, '0'); 
      setRestaurantCount(formattedCount);
    } catch (error) {
      console.error('Error counting restaurants: ', error);
    }
  };

  useEffect(() => {
    countRestaurants();
  }, []);

  const fetchRestaurants = async (wilaya) => {
    setLoading(true);
    try {
      let restaurantsList = [];
      if (wilaya === 'All') {
        for (const wilayaName of wilayas.slice(1)) {
          const wilayaDocRef = doc(db, 'Wilayas', wilayaName);
          const restaurantsRef = collection(wilayaDocRef, 'Restaurants');
          const querySnapshot = await getDocs(restaurantsRef);
          querySnapshot.forEach(doc => {
            restaurantsList.push({ id: doc.id, ...doc.data() });
          });
        }
      } else {
        const wilayaDocRef = doc(db, 'Wilayas', wilaya);
        const restaurantsRef = collection(wilayaDocRef, 'Restaurants');
        const querySnapshot = await getDocs(restaurantsRef);
        querySnapshot.forEach(doc => {
          restaurantsList.push({ id: doc.id, ...doc.data() });
        });
      }
      setRestaurants(restaurantsList);
    } catch (error) {
      console.error('Error fetching restaurants: ', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (shouldFetchRestaurants) {
        fetchRestaurants('All');
      }
    }, [shouldFetchRestaurants])
  );

  return (
    <SafeAreaView style={styles.container}>
      {showRestaurants ? (
        <View style={styles.restaurantView}>
          <View style={styles.SearchBarContainer}>
            <TouchableOpacity style={styles.roundButton} onPress={handleBackToMainView}>
              <Image style={styles.locationIcon} source={require('../assets/left.png')} />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Text style={styles.PlaceHText}>
                <Text style={styles.boldText}>Restaurants</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.roundButton} onPress={() => navigation.navigate('AddNewRes')}>
              <Image style={styles.addNew} source={require('../assets/plus-4.png')} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.restaurantListContainer}>
              <View style={styles.HmenuContainer}>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.Hmenu}>
                  {wilayas.map((wilaya, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.HmenuBTN, { 
                        backgroundColor: selectedWilaya === wilaya ? '#FEC635' : 'white', 
                        borderColor: selectedWilaya === wilaya ? '#FEC635' : 'black' 
                      }]}
                      onPress={() => handlePressWilaya(wilaya)}
                    >
                      <Text style={[styles.HmenuBTNtxt, { color: selectedWilaya === wilaya ? 'white' : 'black' }]}>
                        {wilaya}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Show loading spinner while fetching data */}
              {loading ? (
                <ActivityIndicator size="large" color="#FEC635" style={styles.loadingIndicator} />
              ) : (
                <View style={styles.RestaurantCardContainer}>
                  {restaurants.map((restaurant, index) => (
                    <View key={index} style={styles.RestaurantCard}>
                      <View style={styles.CoverPicContainer}>
                        <Image style={styles.RestaurantCoverPic} source={{ uri: restaurant.cover }} />
                      </View>
                      <View style={styles.CardInfo}>
                        <View style={styles.RIconContainer}>
                          <Image style={styles.IconCard} source={{ uri: restaurant.logo }} />
                        </View>
                        <TouchableOpacity 
                          style={styles.RestaurantDescriptionContainer}
                          onPress={() => navigation.navigate('AdminRMenu', { restaurantId: restaurant.id, wilaya: restaurant.wilaya  })}
                        >
                          <Text style={styles.RestaurantName}>{restaurant.name}</Text>
                          <Text style={styles.RestaurantSpeciality}>{restaurant.speciality}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      ) : showDrivers ? (
        <View style={styles.driversView}>
          <View style={styles.SearchBarContainer}>
            <TouchableOpacity style={styles.roundButton} onPress={handleBackToMainView}>
              <Image style={styles.locationIcon} source={require('../assets/left.png')} />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Text style={styles.PlaceHText}>
                <Text style={styles.boldText}>Drivers</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.roundButton} onPress={() => setModalVisible(true)}>
              <Image style={styles.addNew} source={require('../assets/plus-4.png')} />
            </TouchableOpacity>
          </View>
          <View style={styles.driverWidgetContainer}>
            <View style={styles.activeDriversContainer}>
                <Text style={styles.count}>00</Text>
                <Text style={styles.driverWidgetTitle}>Active drivers</Text>
            </View>
            <View style={styles.offlineDriversContainer}>
              <Text style={styles.count}>00</Text>
              <Text style={styles.driverWidgetTitle}>Offline drivers</Text>
            </View>
            <View style={styles.totalDebtContainer}>
              <Text style={styles.count}>00</Text>
              <Text style={styles.driverWidgetTitle}>Total debt(DA)</Text>
            </View>
          </View>
          {isModalVisible && (
            <View style={styles.newDriverModal}>
              <View style={styles.newDriverContent}>
                <Text style={styles.newDriverTitle}>New Driver</Text>
                <TextInput placeholder='Name' value={name} onChangeText={setName} style={styles.input} />
                <TextInput placeholder='Surname' value={surname} onChangeText={setSurname} style={styles.input} />
                <TextInput placeholder='Phone Number' value={phoneNumber} onChangeText={setPhoneNumber} onFocus={handleFocus} style={styles.input} maxLength={13} keyboardType="numeric" />
                <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
                <TextInput placeholder='Confirm Password' value={confirmPassword} onChangeText={setConfirmPassword} style={styles.input} secureTextEntry />
                <View style={styles.buttonContainernewDriverModal}>
                  <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={handleSignUp}>
                    <Text style={styles.buttonOutlineText}>Create Account</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={() => setModalVisible(false)}>
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mainView}>
          <View style={styles.SearchBarContainer}>
            <TouchableOpacity style={styles.roundButton} onPress={handleLogout}>
              <Image style={styles.locationIcon} source={require('../assets/turn-off.png')} />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Text style={styles.PlaceHText}>
                <Text style={styles.boldText}>{userName || 'Guest'}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.firstLineWidgets}>
            <View style={styles.smallWidgetContainer}>
              <TouchableOpacity style={styles.smallWidget} onPress={handleRestaurantClick}>
                <View style={styles.widgetContent}>
                  <View style={styles.CountContainer}>
                    <Text style={styles.CountResturants}>
                      {restaurantCount ? restaurantCount : '00'}
                    </Text>
                  </View>
                  <Image style={styles.widgetIcon} source={require('../assets/restaurant-2.png')} />
                </View>
                <Text style={styles.widgetTitle}>Restaurants</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.smallWidgetContainer}>
              <TouchableOpacity style={styles.smallWidget} onPress={handleDriversClick}>
                <View style={styles.widgetContent}>
                  <View style={styles.CountContainer}>
                    <Text style={styles.CountDrivers}>00</Text>
                  </View>
                  <Image style={styles.widgetIcon} source={require('../assets/vespa.png')} />
                </View>
                <Text style={styles.widgetTitle}>Drivers</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default AdminHome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingIndicator: {
    marginTop: 100,
  },
  SearchBarContainer: {
    padding: 7,
    flexDirection: 'row',
  },
  searchBar: {
    flex: 1,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    flexDirection: 'row',
    paddingHorizontal: 15,
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
  }),
  // Android elevation style
  ...(Platform.OS === 'android' && {
      elevation: 5, // Adjust elevation value as needed
  }),
},
  boldText: {
    fontWeight: 'bold', 
  },
  roundButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
  }),
    // Android elevation style
    ...(Platform.OS === 'android' && {
    elevation: 5, // Adjust elevation value as needed
      }),
    },
  firstLineWidgets: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  smallWidgetContainer: {
    padding: 10,
  },
  smallWidget: {
    backgroundColor: '#fff',
    borderRadius: 30,
    height: 140,
    width: 170,
    justifyContent: 'space-between',
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
  }),
    // Android elevation style
    ...(Platform.OS === 'android' && {
    elevation: 7, // Adjust elevation value as needed
      }),
  },
  widgetContent: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  CountContainer: {
    borderRadius: 30,
    width: 90,
    height: 90,
    backgroundColor: '#FEC635',
    justifyContent: 'center',
    padding: 12,
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
  }),
    // Android elevation style
    ...(Platform.OS === 'android' && {
    elevation: 8, // Adjust elevation value as needed
      }),
  },
  CountResturants: {
    fontSize : 50,
    fontWeight: 'bold',
    color : 'white'
  },
  CountDrivers: {
    fontSize : 50,
    fontWeight: 'bold',
    color : 'white'
  },
  widgetIcon: {
    marginLeft: 10
  },
  widgetTitle: {
    fontWeight:'bold',
    padding: 15,
    fontSize: 17
  },
  restaurantListContainer: {
    padding: 9,
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  HmenuContainer: {
    padding: 5,
    height: 65,
    alignItems: 'center'
  },
  Hmenu: {
    flexDirection: 'row',
    padding: 7,
  },
  HmenuBTN: {
    backgroundColor: 'white',
    marginLeft: 5,
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  HmenuBTNtxt: {
    padding: 10,
    color: 'black',
  },
  RestaurantCardContainer: {
    padding: 7,
  },
  RestaurantCard: {
    backgroundColor: 'white',
    width: Dimensions.get('window').width * 0.93, // Responsive size
    marginBottom: 9,
    borderRadius: 30,
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
      height: Dimensions.get('window').width * 0.65,
    }),
    // Android elevation style
    ...(Platform.OS === 'android' && {
      elevation: 5, // Adjust elevation value as needed
      height: Dimensions.get('window').width * 0.7,
    }),
},
CoverPicContainer: {
  height: 160,  // Set to a fixed height or a percentage
  width: '100%',  // Make it full width of the card
  borderTopLeftRadius: 40,
  borderTopRightRadius: 40,
  overflow: 'hidden',  // Ensure the image doesn't spill over rounded corners
},
RestaurantCoverPic: {
  height: '100%',
  width: '100%',
  resizeMode: 'cover',  // Ensure the image covers the container
},
  CardInfo: {
    padding: 7,
    flexDirection:'row',
    height: '30%',
  },
  RIconContainer: {
    width: Dimensions.get('window').width * 0.17, // Responsive size
    height: Dimensions.get('window').width * 0.17,
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
},
IconCard: {
    height : '100%',
    width: '100%',
},
  RestaurantDescriptionContainer: {
    padding: 20
  },
  RestaurantName:{
    fontSize: 20,
    fontWeight: 'bold',
  },
  RestaurantSpeciality: {
    color: 'grey',
    fontSize: 15
  },
  newDriverModal: {
    backgroundColor: '#f1f1f1',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    paddingHorizontal: 15,
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC631', // Shadow color
      shadowOffset: { width: 1, height: 1 }, // Shadow offset
      shadowOpacity: 0.8, // Shadow opacity
      shadowRadius: 10, // Shadow blur radius
  }),
  // Android elevation style
  ...(Platform.OS === 'android' && {
      elevation: 20, // Adjust elevation value as needed
  }),
  },
  shadowContainer: {
    position: 'absolute',
    backgroundColor: '#FEC631', // Shadow color
    borderRadius: 30,
    width: '100%',
    height: '100%',
    top: 5, // Offset to create shadow effect
    left: 5,
  },
  newDriverContent: {
    padding: 20,
    width: Dimensions.get('window').width * 0.87,
  },
  newDriverTitleContainer: {
    alignItems: 'center',
    marginBottom: 10
  },
  newDriverTitle: {
    fontSize: 20,
    fontWeight: '500',
  },
input: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 5,
},
buttonContainernewDriverModal: {
  alignItems: 'center',
  marginTop: 10,
},
button: {
  backgroundColor: '#FEC635',
  width: Dimensions.get('window').width * 0.57,
  padding: 15,
  borderRadius: 10,
  alignItems: 'center',
  marginTop: 15,
},
buttonOutline: {
  backgroundColor: 'white',
  marginTop: 10,
  borderColor: '#FEC635',
  borderWidth: 2,
},
buttonOutlineText: {
  color: '#FEC635',
  fontWeight: '700',
  fontSize: 16,
},
buttonText: {
  color: 'white',
  fontWeight: '700',
  fontSize: 16,
},
driverWidgetContainer: {
    marginTop: 10,
    flexDirection: 'row',
    width: Dimensions.get('window').width * 1,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'space-around',
    padding: 10,
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
  }),
    // Android elevation style
    ...(Platform.OS === 'android' && {
    elevation: 5,
  }),
},
offlineDriversContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  borderLeftWidth: 1,
  borderRightWidth: 1,
  borderColor: '#FEC631',
  width: Dimensions.get('window').width * 0.35,
},
activeDriversContainer: {
  alignItems: 'center',
  justifyContent: 'center',
},
totalDebtContainer: {
  alignItems: 'center',
  justifyContent: 'center',
},
count: {
  fontWeight: '500',
  fontSize: 18,
  color: '#FEC631'
},
driverWidgetTitle: {
  marginTop: 5,
  fontWeight: '500',
  fontSize: 15,
},
});
