import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    View, Text, SafeAreaView, StyleSheet, ScrollView, 
    TouchableOpacity, Image, TextInput, Keyboard, 
    ActivityIndicator, StatusBar, Platform, Linking, Alert, AppState,Modal,TouchableWithoutFeedback
} from 'react-native';
import * as Location from 'expo-location'; // Ensure expo-location is installed
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../UserContext';
import { Dimensions} from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { usePushNotifications } from '../usePushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HomeScreen = ({ route }) => {
    const [userName, setUserName] = useState('');
    const [userId, setUserId] = useState(null);
    const [wilaya, setWilaya] = useState(''); 
    const [role, setRole] = useState('');
    const [restaurants, setRestaurants] = useState([]);
    const navigation = useNavigation();
    const [selectedCategory, setSelectedCategory] = useState(null); // State for selected categories
    const categories = ['Fast Food', 'Restaurant', 'Pizzeria', 'Patisserie', 'Cafetéria'];
    const [activeView, setActiveView] = useState('home');
    const [profilePictureLoading, setProfilePictureLoading] = useState('');
    const [profilePicture, setProfilePicture] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loading1, setLoading1] = useState(true);
    const [uploading, setUploading] = useState(false);
    const user = auth.currentUser;
    const { setUser } = useUser();
    const [favorites, setFavorites] = useState([]);
    const [appState, setAppState] = useState(AppState.currentState);
    const { expoPushToken, notification } = usePushNotifications();
    const data = JSON.stringify(notification, undefined, 2);
    const [orders, setOrders] = useState([]);
    const [isActiveOrderModalVisible, setIsActiveOrderModalVisible] = useState(false);
    const [isCanceledOrderModalVisible, setIsCanceledOrderModalVisible] = useState(false);
    const [isDeliveredOrderModalVisible, setIsDeliveredOrderModalVisible] = useState(false);
    const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
    const [isAboutUsModalVisible, setIsAboutUsModalVisible] = useState(false);
    const [isContactUsModalVisible, setContactUsModalVisible] = useState(false);
    const [OrderData, setOrderDataa] = useState([]);
    const { shouldRefetchOrders } = route.params || {};

    useFocusEffect(
        useCallback(() => {
          if (shouldRefetchOrders) {
            fetchOrders();
            setActiveView('menu');
          }
        }, [shouldRefetchOrders])
      );

    const handleOrderCardClick = (status, id, order) => {
        if (status === 'Canceled') {
            setOrderDataa(order);
              setIsCanceledOrderModalVisible(true);
        } else if (status === 'Delivered') {
            setOrderDataa(order);
              setIsDeliveredOrderModalVisible(true);
        } else if (status === 'Active') {
            setOrderDataa(order);
              setIsActiveOrderModalVisible(false);
              setIsDeliveredOrderModalVisible(false);
              setIsCanceledOrderModalVisible(false);
        }
    };
    const fetchOrders = async () => {
        setLoading1(true);
        try {
            const ordersQuery = query(
                collection(db, 'orders'),
                where('clientId', '==', user.uid)
            );
            const ordersSnapshot = await getDocs(ordersQuery);
            const ordersData = [];
  
            for (const orderDoc of ordersSnapshot.docs) {
                const orderData = orderDoc.data();
                const driverDoc = await getDoc(doc(db, 'users', orderData.driverId));
                const restaurantDoc = await getDoc(doc(db, 'Wilayas', orderData.wilaya, 'Restaurants', orderData.restaurantId));
  
                ordersData.push({
                    ...orderData,
                    driver: driverDoc.exists() ? driverDoc.data() : null,
                    restaurant: restaurantDoc.exists() ? restaurantDoc.data() : null,
                    id: orderDoc.id
                });
            }
  
            setOrders(ordersData);
        } catch (error) {
            console.error("Error fetching orders: ", error);
        } finally {
            setLoading1(false);
        }
    };

    useEffect(() => {
        const updateNotificationToken = async () => {
            if (userId && expoPushToken) {
                try {
                    const userDocRef = doc(db, 'users', userId);
                    await updateDoc(userDocRef, { notificationToken: expoPushToken });
                    console.log('Notification token saved to Firestore:', expoPushToken);
                    fetchOrders();
                    console.log('ordersFetched')
                } catch (error) {
                    console.error('Error saving notification token:', error);
                }
            } else {
                console.log('Waiting for both userId and expoPushToken to be set...');
            }
        };
      
        updateNotificationToken();
      }, [userId, expoPushToken]); 
    // Fetch favorites when the wilaya changes
    useEffect(() => {
        fetchFavorites(wilaya);
    }, [wilaya, fetchFavorites]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            AsyncStorage.removeItem('user'); // Clear user from AsyncStorage
            navigation.replace('Login'); // Navigate to login screen
        } catch (error) {
            console.error('Error signing out: ', error);
        }
    };
    // Function to handle changing the active view
    const handleTabChange = (view) => {
      setActiveView(view);
  };
    
    // Memoized fetchUserData function to avoid re-creation on every render
    const fetchUserData = useCallback(async () => {
      if (user) {
          try {
              setProfilePictureLoading(true);
              const userRef = collection(db, 'users');
              const q = query(userRef, where("email", "==", user.email));
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                  querySnapshot.forEach(doc => {
                      const userData = doc.data();
                      setUserName(`${userData.name} ${userData.surname}`);
                      setRole(`${userData.role}`);
                      setProfilePicture(userData.profilePicture);
                      setProfilePictureLoading(false);
                      setUserId(doc.id);
                  });
              }
          } catch (error) {
              console.error('Error fetching user data: ', error);
          }
      }
  }, [user]);
  

  const getLocation = useCallback(async () => {
    try {
      // Check if location services are enabled
      const locationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!locationServicesEnabled) {
        console.log('Location services are disabled');
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services to continue using the app.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'OK',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:').catch(err =>
                    console.error('Error opening settings:', err)
                  );
                } else {
                  Linking.openSettings().catch(err =>
                    console.error('Error opening settings:', err)
                  );
                }
              },
            },
          ]
        );
        return;
      }
  
      console.log('Location services enabled, requesting permission');
  
      // Request location permissions from the user
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        setWilaya('Unknown');
        return;
      }
  
      console.log('Permission granted, fetching location');
  
      // Get the user's current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
  
      const { latitude, longitude } = location.coords;
      console.log('Location obtained:', latitude, longitude);
  
      // Reverse geocode to get region/wilaya name
      let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
  
      if (geocode.length > 0) {
        let region = geocode[0].region?.trim() || geocode[0].subregion?.trim() || 'Unknown';
  
        // Known wilayas
        const wilayas = ['Tiaret', 'Alger', 'Chlef', 'Oran', 'Tlemcen'];
  
        // Check if the region is one of the known wilayas
        let wilayaName = wilayas.find(w => region.includes(w)) || 'Unknown';
  
        setWilaya(wilayaName);
        console.log('Wilaya:', wilayaName);
      } else {
        setWilaya('Unknown');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setWilaya('Unknown');
    }
  }, []);

  // Track app state changes to detect when the user returns from the settings
  useEffect(() => {
    const handleAppStateChange = nextAppState => {
      if (
        appState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground, checking location again');
        getLocation(); // Fetch location again when the app becomes active
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    // Cleanup the event listener on unmount
    return () => subscription.remove();
  }, [appState, getLocation]);

    // Fetch both user data and location in parallel
    useEffect(() => {
      const fetchData = async () => {
          try {
              setLoading(true);
              await Promise.all([getLocation(), fetchUserData()]);
              setLoading(false);
          } catch (error) {
              console.error('Error fetching data: ', error);
              setLoading(false);
          }
      };
  
      fetchData();
  }, [fetchUserData, getLocation, user]); // Add 'user' to dependencies

  useEffect(() => {
    fetchRestaurants(wilaya, selectedCategory);
    fetchFavorites(selectedCategory);
}, [wilaya, selectedCategory]);

  // Function to handle category selection
  const handleCategorySelect = (category) => {
    // If the same category is clicked, unselect it (toggle off)
    if (selectedCategory === category) {
        setSelectedCategory(null);
    } else {
        setSelectedCategory(category);
    }
};
const handleCategorySelectFavorites = (category) => {
    // If the same category is clicked, unselect it (toggle off)
    if (selectedCategory === category) {
        setSelectedCategory(null);
    } else {
        setSelectedCategory(category);
    }
};

useEffect(() => {
    if (user) {
        fetchFavorites(selectedCategory);
    }
}, [selectedCategory, user]);

const fetchFavorites = useCallback(async (selectedCategory) => {
    if (user) {
        const favoritesRef = collection(db, 'Favorites');
        const q = query(favoritesRef, where("userId", "==", user.uid), where("wilaya", "==", wilaya));
        const querySnapshot = await getDocs(q);

        const favoriteNames = [];
        querySnapshot.forEach(doc => {
            favoriteNames.push(doc.data().name);
            console.log('Favorite Names:', favoriteNames);
        });

        // Fetch detailed data for each favorite restaurant with category filtering
        const favoriteRestaurants = await Promise.all(
            favoriteNames.map(async (name) => {
                let restaurantRef = query(
                    collection(doc(db, 'Wilayas', wilaya), 'Restaurants'),
                    where('name', '==', name)
                );

                // Apply category filter if a category is selected
                if (selectedCategory) {
                    restaurantRef = query(
                        restaurantRef,
                        where('categories', 'array-contains', selectedCategory)
                    );
                }

                const restaurantSnapshot = await getDocs(restaurantRef);
                let restaurantData = null;
                restaurantSnapshot.forEach(doc => {
                    restaurantData = { id: doc.id, ...doc.data() }; // Store restaurant ID and data
                });

                // Log restaurant names that contain the selected category
                if (restaurantData) {
                    console.log(`Restaurant with category ${selectedCategory}:`, restaurantData.name);
                }
                return restaurantData;
            })
        );

        // Filter out any null results in case a restaurant wasn't found or didn't match the category
        const filteredFavorites = favoriteRestaurants.filter(restaurant => restaurant !== null);
        setFavorites(filteredFavorites); // Set the favorites state with detailed restaurant data
    }
}, [user, wilaya]);



const fetchRestaurants = async (wilaya, selectedCategory) => {
    setLoading1(true); // Trigger loading only for the card section
    try {
        let restaurantsList = [];
        const wilayaDocRef = doc(db, 'Wilayas', wilaya);
        const restaurantsRef = collection(wilayaDocRef, 'Restaurants');
        
        let querySnapshot;

        if (!selectedCategory) {
            // Fetch all restaurants if no category is selected
            querySnapshot = await getDocs(restaurantsRef);
        } else {
            // Fetch restaurants matching the selected category
            const restaurantsQuery = query(
                restaurantsRef,
                where('categories', 'array-contains', selectedCategory)
            );
            querySnapshot = await getDocs(restaurantsQuery);
        }

        if (!querySnapshot.empty) {
            querySnapshot.forEach(doc => {
                restaurantsList.push({ id: doc.id, ...doc.data() });
            });
        }

        setRestaurants(restaurantsList);
    } catch (error) {
        console.error('Error fetching restaurants: ', error);
    } finally {
        setLoading1(false); // Turn off the loading spinner
    }
};
    


    const uploadImage = async () => {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
          alert("Permission to access camera roll is required!");
          return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
      });

      if (!result.canceled) {
          const imageUri = result.assets[0].uri;

          const storage = getStorage();
          const userId = auth.currentUser.uid;
          const reference = ref(storage, `profile_pictures/${userId}.jpg`);

          const response = await fetch(imageUri);
          const blob = await response.blob();

          try {
              setUploading(true);
              await uploadBytes(reference, blob);
              const url = await getDownloadURL(reference);
              await updateDoc(doc(db, 'users', userId), { profilePicture: url });
              setProfilePicture(url);
          } catch (error) {
              console.error('Error uploading image: ', error);
          } finally {
              setUploading(false);
          }
      }
  };

    if (loading) {
        // Render a loading screen while fetching location and user data
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FEC635" />
                <Text style={styles.loadingText}>Hungry !...</Text>
            </SafeAreaView>
        );
    }
      
      const renderStatusContainer = (status) => {
        if (status === 'Canceled') {
            return (
              <View style={styles.canceledStatusContainer}>
                <Text style={styles.statusText}>Canceled</Text>
              </View>
            );
        } else if (status === 'Delivered') {
            return (
              <View style={styles.delivredStatusContainer}>
                <Text style={styles.statusText}>Delivred</Text>
              </View>
            );
        } else {
            return (
              <View style={styles.activeStatusContainer}>
                <Text style={styles.statusText}>Active</Text>
              </View>
            );
        }
      };

    return (
      <SafeAreaView style={styles.container}>
          {/* Content Section */}
              {/* Conditionally render the content based on the active view */}
              {activeView === 'home' && (
                  <View style={styles.viewContainer}>
                    <View style={styles.SearchBarContainer}>
                       <View style={styles.roundButton}>
                            <Image style={styles.locationIcon}
                              source={require('../assets/gps.png')}
                            />
                        </View>
                    <View style={styles.searchBar}>
                        <Text style={styles.PlaceHText}>
                            <Text style={styles.boldText}>Restaurants In</Text> {wilaya || 'Unknown'}
                        </Text>
                    </View>
            </View>

            {/* Content Section */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.headerContainer}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.welcomeText}>Welcome</Text>
                            <Text style={styles.userName}>{userName || 'Guest'}</Text>
                        </View>
                        <Image 
                            style={styles.HederIcon}
                            source={require('../assets/restaurant.png')}
                        />
                    </View>
                </View>
                {/* Vmenu Section */}
                <View style={styles.HmenuContainer}>
                        <ScrollView showsHorizontalScrollIndicator={false} horizontal={true} style={styles.Hmenu}>
                            {categories.map((category, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    style={[
                                        styles.HmenuBTN, 
                                        { 
                                            backgroundColor: selectedCategory === category ? '#FEC635' : 'white' // Single selection
                                        }, 
                                        { borderColor: selectedCategory === category ? '#FEC635' : 'black' }
                                    ]} 
                                    onPress={() => handleCategorySelect(category)} // Handle single category selection
                                >
                                    <Text style={[styles.HmenuBTNtxt, { color: selectedCategory === category ? 'white' : 'black' }]}>
                                        {category}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Cards Section */}
                    {loading1 ? (
                        <ActivityIndicator size="large" color="#FEC635" style={styles.loadingIndicator} />
                    ) : (
                        <View style={styles.RestaurantCardContainer}>
                            {restaurants.map((restaurant, index) => (
                                <TouchableOpacity key={index} style={styles.RestaurantCard}
                                onPress={() => navigation.navigate('Menu', { restaurantId: restaurant.id, wilaya: restaurant.wilaya })}>
                                    <View style={styles.CoverPicContainer}>
                                        <Image style={styles.RestaurantCoverPic} source={{ uri: restaurant.cover }} />
                                    </View>
                                    <View style={styles.CardInfo}>
                                        <View style={styles.RIconContainer}>
                                            <Image style={styles.IconCard} source={{ uri: restaurant.logo }} />
                                        </View>
                                        <View style={styles.RestaurantDescriptionContainer}>
                                            <Text style={styles.RestaurantName}>{restaurant.name}</Text>
                                            <Text style={styles.RestaurantSpeciality}>{restaurant.speciality}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
            </ScrollView>
                  </View>
              )}
              {activeView === 'favorites' && (
                  <View style={styles.viewContainer}>
                    {loading ? (
                         <ActivityIndicator size="large" color="#FEC635" />
                            ) : (
                             <><View style={styles.favHeader}>
                             <Text style={styles.favHeaderTitle}>Favorites</Text>
                             <View style={styles.HmenuFavsContainer}>
                                 <ScrollView showsHorizontalScrollIndicator={false} horizontal={true} style={styles.Hmenu}>
                                     {categories.map((category, index) => (
                                         <TouchableOpacity
                                             key={index}
                                             style={[
                                                 styles.HmenuBTN,
                                                 {
                                                     backgroundColor: selectedCategory === category ? '#FEC635' : 'white' // Single selection
                                                 },
                                                 { borderColor: selectedCategory === category ? '#FEC635' : 'black' }
                                             ]}
                                             onPress={() => handleCategorySelectFavorites(category)} // Handle single category selection
                                         >
                                             <Text style={[styles.HmenuBTNtxt, { color: selectedCategory === category ? 'white' : 'black' }]}>
                                                 {category}
                                             </Text>
                                         </TouchableOpacity>
                                     ))}
                                 </ScrollView>
                             </View>
                         </View>
                               {/* If the user has liked restaurants, show them */}
                              {favorites.length > 0 ? (
                                <>
                                    <ScrollView>
                                    {loading1 ? (
                                                <ActivityIndicator size="large" color="#FEC635" style={styles.loadingIndicator} />
                                            ) : (
                                            <View style={styles.RestaurantCardContainer}>
                                                {favorites.map((favorite, index) => (
                                                    <View key={index} style={styles.RestaurantCard}>
                                                        <View style={styles.CoverPicContainer}>
                                                            <Image style={styles.RestaurantCoverPic} source={{ uri: favorite.cover }} />
                                                        </View>
                                                        <View style={styles.CardInfo}>
                                                            <View style={styles.RIconContainer}>
                                                                <Image style={styles.IconCard} source={{ uri: favorite.logo }} />
                                                            </View>
                                                            <TouchableOpacity
                                                                style={styles.RestaurantDescriptionContainer}
                                                                onPress={() => navigation.navigate('Menu', { restaurantId: restaurant.id, wilaya: restaurant.wilaya })}
                                                            >
                                                                <Text style={styles.RestaurantName}>{favorite.name}</Text>
                                                                <Text style={styles.RestaurantSpeciality}>{favorite.speciality}</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                            )}
                                        </ScrollView>
                                        </>
                              ) : (
                                // If no liked restaurants, show this placeholder
                                <View style={styles.NoFavoritesContainer}>
                                  <Image style={styles.favSketch} source={require('../assets/undraw_favourite_item_pcyo.png')} />
                                  <Text style={styles.FavoritesTxt}>Like a restaurant and you will find it here</Text>
                                </View>
                               )}
                             </>
                         )}
                  </View>
              )}
              {activeView === 'menu' && (
                <View style={styles.viewContainer}>
                 {loading1 ? (
                    <View style={styles.loadingContainerOrders}>
                        <ActivityIndicator size="large" color="#FEC635"/>
                    </View>
                 ) : (
                   <>
                     {/* If the user has made orders, show them */}
                     {orders.length > 0 ? (
                        <><View style={styles.headercontainerOrders}>
                        <Text style={styles.headerTextOrders}>Orders</Text>
                    </View><ScrollView showsVerticalScrollIndicator={false}>
                                            {orders.sort((a, b) => {
                                                const dateTimeA = new Date(`${a.date.split('/').reverse().join('-')}T${a.time}`);
                                                const dateTimeB = new Date(`${b.date.split('/').reverse().join('-')}T${b.time}`);
                                                return dateTimeB - dateTimeA; // Newest orders first
                                             })
                                            .map((order) => (
                                                
                                                <TouchableOpacity
                                                key={order.id}
                                                style={styles.orderCard}
                                                onPress={() => handleOrderCardClick(order.status, order.id, order)}
                                              >
                                                <View style={styles.div1}>
                                                   <View style={styles.RIconContainerCard}>
                                                     <Image style={styles.IconCard} source={{ uri: order.restaurant?.logo }} />
                                                   </View>
                                                </View>
                                                <View style={styles.div2}>
                                                   <Text style={styles.restaurantName}>{order.restaurant?.name}</Text>
                                                   <Text style={styles.orderDatendTime}>
                                                      {order?.time}
                                                    </Text>
                                                   <Text style={styles.clientName}>
                                                      {order.driver?.name} {order.driver?.surname}
                                                   </Text>
                                                                      
                                                </View>
                                                <View style={styles.div3}>
                                                  <Text style={styles.fees}>{order?.deliveryFees} DA</Text>
                                                  {renderStatusContainer(order.status)}
                                                </View>
                                              </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                        <Modal visible={isActiveOrderModalVisible} transparent animationType="slide">
                                            <View style={styles.modalOrderOverlay}>
                                                <Text>Active Order</Text>
                                                <TouchableOpacity onPress={() => setIsActiveOrderModalVisible(false) }>
                                                    <Text>close</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </Modal>
                                        <Modal visible={isCanceledOrderModalVisible} transparent animationType="slide">
                                        <TouchableWithoutFeedback onPress={() => setIsCanceledOrderModalVisible(false)}>
                                            <View style={styles.modalOrderOverlay}>
                                            <TouchableWithoutFeedback>
                                                <View style={styles.canceledModalContainer}>
                                                   <View style={styles.canceledModalTitle}>
                                                      <Text style={styles.canceledModalTitleTxt}>Canceled</Text>
                                                   </View>
                                                   <View style={styles.canceledByContainer}>
                                                      <Text style={styles.canceledByTitle}>Canceled by: </Text>
                                                      <Text style={styles.canceledByData}>{OrderData?.canceledBy}</Text>
                                                   </View>
                                                  <View style={styles.cancelReasonContainer}>
                                                      <Text style={styles.cancelReasonTitle}>Reason:</Text>
                                                      <View style={styles.cancelReasonDataContainer}>
                                                        <Text style={styles.cancelReasonData}>{OrderData?.cancelReason}</Text>
                                                      </View>
                                                  </View>
                                                   <TouchableOpacity style={styles.canceledModalBtn} onPress={() => setIsCanceledOrderModalVisible(false)}>
                                                      <Text style={styles.canceledModalBtnTxt}>Close</Text>
                                                   </TouchableOpacity>
                                                </View>
                                                </TouchableWithoutFeedback>
                                              </View>
                                              </TouchableWithoutFeedback>
                                        </Modal>
                                        <Modal visible={isDeliveredOrderModalVisible} transparent animationType="slide">
                                        <TouchableWithoutFeedback onPress={() => setIsDeliveredOrderModalVisible(false)}>
                                          <View style={styles.modalOrderOverlay}>
                                          <TouchableWithoutFeedback>
                                              <View style={styles.deliveredModalContainer}>
                                                <View style={styles.delivredModalTitleContainer}>
                                                  <Text style={styles.delivredModalTitle}>{OrderData?.status}</Text>
                                                </View>
                                                <View style={styles.delivredModalFirstLine}>
                                                  <View style={styles.restaurantInfoDelivredModal}>
                                                    <View style={styles.RIconContainerOrderModal}>
                                                     <Image style={styles.IconCard} source={{ uri: OrderData.restaurant?.logo }} />
                                                    </View>
                                                    <Text style={styles.RName}>{ OrderData.restaurant?.name }</Text>
                                                  </View>
                                                  <View style={styles.restaurantInfoDelivredModal}>
                                                    <View style={styles.RIconContainerOrderModal}>
                                                      <Image style={styles.IconCard} source={require('../assets/user-11.png')} />
                                                    </View>
                                                    <View style={styles.clientInfoData}>
                                                      <Text style={styles.clientInfoDataTxt}>{OrderData.driver?.name} {OrderData.driver?.surname}</Text>
                                                    </View>
                                                  </View>
                                                </View>
                                                <ScrollView style={styles.orderList} showsVerticalScrollIndicator={false}>
                                                 {OrderData.orderedItems?.map((item, index) => (
                                                   <View style={styles.orderContainer} key={index}>
                                                     <Text style={styles.orderCount}>{item.count}</Text>
                                                      <Text style={styles.orderName}>{item.itemName}</Text>
                                                      <Text style={styles.orderPrice}>{item.price} DA</Text>
                                                    </View>
                                                  ))}
                                                </ScrollView>
                                                <View style={styles.pricesCalculationsContainer}>
                                                  <View style={styles.priceLine}>
                                                    <Text style={styles.priceLineTxt}>Total order</Text>
                                                    <Text style={styles.priceLineData}>{OrderData?.totalPrice} DA</Text>
                                                  </View>
                                                  <View style={styles.priceLine}>
                                                    <Text style={styles.priceLineTxt}>Fees</Text>
                                                    <Text style={styles.priceLineData}>{OrderData?.deliveryFees} DA</Text>
                                                  </View>
                                                  <View style={styles.priceLine}>
                                                    <Text style={styles.priceLineTxt}>Total</Text>
                                                    <Text style={styles.priceLineData}>{Number(OrderData.totalPrice || 0) + Number(OrderData.deliveryFees || 0)} DA</Text>
                                                  </View>
                                                </View>
                                                <TouchableOpacity style={styles.canceledModalBtn} onPress={() => setIsDeliveredOrderModalVisible(false)}>
                                                    <Text style={styles.canceledModalBtnTxt}>Close</Text>
                                                 </TouchableOpacity>
                                              </View>
                                              </TouchableWithoutFeedback>
                                          </View>
                                          </TouchableWithoutFeedback>
                                      </Modal>
                                        </>
                     ) : (
                       <View style={styles.viewContainer}>
                        <View style={styles.noOrdersSketch}> 
                         <Image 
                           style={styles.orderSketch}
                           source={require('../assets/undraw_shopping_app_flsj.png')}
                         />
                         <Text style={styles.FavoritesTxt}>You haven't made any orders yet</Text>
                        </View>
                       </View>
                      )}
                    </>
                  )}
                </View>
                )}

              {activeView === 'profile' && (
                  <View style={styles.viewContainer}> 
                  <View style={styles.profileContainer}>
                     <View style={styles.headerContainer4}>
                          <View style={styles.header4}>
                            <View style={styles.ParentContainer4}>
                              <TouchableOpacity style={styles.ProfilePicContainer4} onPress={uploadImage} >
                            {uploading || profilePictureLoading  ? (
                                <ActivityIndicator size="large" color="#FEC635" style={styles.loadingIndicator4} />
                            ) : (
                                <Image
                                    style={styles.profilePIC4}
                                    source={profilePicture ? { uri: profilePicture } : require('../assets/user-11.png')}
                                />
                            )}
                        </TouchableOpacity>
                        <Text style={styles.userName4}>{userName || 'Guest'}</Text>
                        <Text style={styles.roleTXT4}>{role || 'Role'}</Text>
                    </View>
                    <View style={styles.profileMenu4}>
                        <TouchableOpacity style={styles.buttonPmenu4}>
                            <View style={styles.searchBar4}>
                                <Image style={styles.PmenuLogo4} source={require('../assets/account.png')} />
                                <Text style={styles.PlaceHText4}>Change password</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.buttonPmenu4}>
                            <View style={styles.searchBar4}>
                                <Image style={styles.PmenuLogo4} source={require('../assets/phone-call-2.png')} />
                                <Text style={styles.PlaceHText4}>Contact Us</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.buttonPmenu4}>
                            <View style={styles.searchBar4}>
                                <Image style={styles.PmenuLogo4} source={require('../assets/customer-service.png')} />
                                <Text style={styles.PlaceHText4}>About us</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.buttonPmenuLogout4} onPress={handleLogout}>
                            <View style={styles.searchBar4}>
                                <Image style={styles.PmenuLogo4} source={require('../assets/logout.png')} />
                                <Text style={styles.PlaceHText4}>Log Out</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            </View>
            <Modal visible={isChangePasswordModalVisible} transparent animationType="slide">
                                        <TouchableWithoutFeedback onPress={() => setIsChangePasswordModalVisible(false)}>
                                          <View style={styles.modalOrderOverlay}>
                                          <TouchableWithoutFeedback>

                                          </TouchableWithoutFeedback>
                                          </View>
                                          </TouchableWithoutFeedback>
                                          </Modal>
        <Modal visible={isAboutUsModalVisible} transparent animationType="slide">
                                        <TouchableWithoutFeedback onPress={() => setIsAboutUsModalVisible(false)}>
                                          <View style={styles.modalOrderOverlay}>
                                          <TouchableWithoutFeedback>

                                          </TouchableWithoutFeedback>
                                          </View>
                                          </TouchableWithoutFeedback>
                                          </Modal>
        <Modal visible={isContactUsModalVisible} transparent animationType="slide">
                                        <TouchableWithoutFeedback onPress={() => setIsContactUsModalVisible(false)}>
                                          <View style={styles.modalOrderOverlay}>
                                          <TouchableWithoutFeedback>

                                          </TouchableWithoutFeedback>
                                          </View>
                                          </TouchableWithoutFeedback>
                                          </Modal>
                  </View>
              )}
          {/* Horizontal Button Menu */}
          <View style={styles.footerMenu}>
              <TouchableOpacity style={styles.footerButton} onPress={() => { handleTabChange('home'); setSelectedCategory(null);}}>
                  <Image style={styles.footerIcon} source={require('../assets/home.png')} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerButton} onPress={() => { handleTabChange('favorites'); fetchFavorites(); setSelectedCategory(null);}}>
                <Image style={styles.footerIcon} source={require('../assets/favorites.png')} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerButton} onPress={() => { handleTabChange('menu')}}>
                  <Image style={styles.footerIcon} source={require('../assets/menu.png')} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerButton} onPress={() => handleTabChange('profile')}>
                  <Image style={styles.footerIcon} source={require('../assets/user.png')} />
              </TouchableOpacity>
          </View>
      </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
      flex: 1,
      backgroundColor: 'white',
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
},
viewContainer: {
    flex: 1,
    alignItems: 'center',
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
  headerContainer: {
      padding: 7
  },
  header: {
      flexDirection: 'row',
      backgroundColor: '#fff',
      padding: 20,
      borderRadius: 40,
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
        elevation: 5, // Adjust elevation value as needed
    }),
  },
  headercontainerOrders: {
    backgroundColor: '#fff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    flexDirection: 'row',
    paddingHorizontal: 15,
    padding: 10,
    height: Dimensions.get('window').width * 0.13,
    width: Dimensions.get('window').width * 0.94,
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
  HederIcon: {
      transform: [{ rotate: '-25deg' }],
      
  },
  welcomeText: {
      fontSize: 20,
      color: '#FEC635',
      fontWeight: 'bold'
  },
  userName: {
    fontSize: 24,
    marginTop: 5,
    fontWeight: 'bold'
  },
  content: {
      flexGrow: 1,
      paddingTop: 10,
  },
  SearchBarContainer: {
      padding: 7,
      flexDirection: 'row',
  },
  headerTextOrders: {
    fontWeight: 'bold',
    fontSize: 16,
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
  noOrdersSketch: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  orderSketch: {
    width: Dimensions.get('window').width * 0.90,
    height: Dimensions.get('window').width * 0.90,
  },
  NoFavoritesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: Dimensions.get('window').width * 1.5,
  },
  favHeaderTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    marginLeft: 14,
  },
  favHeader: {
    height: Dimensions.get('window').width * 0.16,
    marginBottom: 24,
  },
  favSketch: {
    width: Dimensions.get('window').width * 0.60, // Responsive size
    height: Dimensions.get('window').width * 0.80,
  },
  FavoritesTxt: {
    fontSize: 19,
    fontWeight: '500',
  },
  searchInput: {
      flex: 1,
      height: 40,
      fontSize: 16,
      paddingHorizontal: 10,
  },
  boldText: {
      fontWeight: 'bold',
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
  HmenuBTNtxt: {
    padding: 10,
    color: 'black',
  },
  loadingIndicator: {
    marginTop: 100
},
  loadingContainerOrders: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  RestaurantCardContainer: {
    padding: 9,
  },
  RestaurantCard: {
    backgroundColor: 'white',
    height: 260,  // Fixed height to ensure consistency
    width: Dimensions.get('window').width * 0.95,
    marginBottom: 9,
    borderRadius: 30,
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
RIconContainerCard: {
    width: Dimensions.get('window').width * 0.2, // Responsive size
    height: Dimensions.get('window').width * 0.2,
    borderRadius: 50,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  div3: {
    alignItems: 'center',
    justifyContent: 'center',
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
  footerMenu: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: '#DDD',
      backgroundColor: 'white'
  },
  footerButton: {
      alignItems: 'center',
  },
  footerIcon: {
      width: 30,
      height: 30,
  },
  loadingContainer4: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
},
loadingText4: {
    marginTop: 10,
    fontSize: 16,
    color: 'gray',
},
headerContainer4: {
    padding: 20,
    flex: 1,
    width: '100%',
},
header4: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
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
ParentContainer4: {
    alignItems: 'center',
    marginBottom: 30,
},
ProfilePicContainer4: {
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    width: Dimensions.get('window').width * 0.37, // Responsive size
    height: Dimensions.get('window').width * 0.37,
},
ProfilePicChildContainer4: {
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    width: Dimensions.get('window').width * 0.37, // Responsive size
    height: Dimensions.get('window').width * 0.37,
},
profilePIC4: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
},
userName4: {
    fontSize: 24,
    marginTop: 10,
    fontWeight: 'bold',
    textAlign: 'center',
},
roleTXT4: {
    color: 'grey',
    fontSize: 15,
    textAlign: 'center',
},
profileMenu4: {
    width: '100%',
},
buttonPmenu4: {
    paddingVertical: 10,
},
buttonPmenuLogout4: {
    paddingVertical: 10,
    marginTop: 'auto',
},
searchBar4: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'android' ? 10 :15,
    paddingHorizontal: 20,
    borderRadius: 30,
    backgroundColor: '#fff',
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
PmenuLogo4: {
    width: 30,
    height: 30,
},
PlaceHText4: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
},
profileContainer: {
    height: '100%',
    width: '100%',
    paddingVertical: 50,
},
boldText4: {
    fontWeight: 'bold',
},
orderCard: {
    backgroundColor: '#fff',
        borderRadius: 30,
        marginHorizontal: 10,
        padding: 10,
        width: Dimensions.get('window').width * 0.95,
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
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
  fees: {
    color: '#FEC631',
    fontSize: 25,
    fontWeight: 'bold'
  },
  div2: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCardFirstLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    width: Dimensions.get('window').width * 0.5,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  OIconContainer: {
    width: Dimensions.get('window').width * 0.11, // Responsive size
    height: Dimensions.get('window').width * 0.11,
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  IconOCard: {
      height : '100%',
      width: '100%',
  },
  restaurantName: {
    marginLeft: 5,
    fontWeight: '500',
  },
  activeStatusContainer: {
    backgroundColor: '#4CAD86',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    flexDirection: 'row',
    paddingHorizontal: 15,
    padding: 5,
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
    }),},
    activeStatusContainer: {
      backgroundColor: '#4CAD86',
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 10,
      flexDirection: 'row',
      paddingHorizontal: 15,
      padding: 5,
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
      }),},
  delivredStatusContainer: {
    backgroundColor: '#FEC631',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    flexDirection: 'row',
    paddingHorizontal: 15,
    padding: 5,
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
    }),},
    canceledStatusContainer: {
    backgroundColor: '#91403D',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    flexDirection: 'row',
    paddingHorizontal: 15,
    padding: 5,
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
    }),},
  statusText: {
    color: 'white',
  },
  orderCardsecondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientName: {
   fontWeight: '500'
  },
  clientPhoneNumber: {
    fontWeight: '500',
    marginLeft: 5,
  },
  orderCardThirdLine: {
    marginLeft: 64,
    marginTop: 5,
  },
  orderDatendTime: {
    fontWeight: '500'
  },
  orderTitle: {
    width: Dimensions.get('window').width * 0.9,
    justifyContent: 'flex-start',
    marginBottom: 15,
  },
  orderTitleTxt: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  modalOrderOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  HmenuFavsContainer: {
    ...(Platform.OS === 'android' && {
        height: Dimensions.get('window').width * 0.16
    }),
    ...(Platform.OS === 'ios' && {
        height: Dimensions.get('window').width * 0.13
    }),
  },
  modalOrderOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  canceledModalContainer: {
    backgroundColor: '#fff',
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
  canceledModalTitle: {
      backgroundColor: '#91403D',
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 10,
      width: Dimensions.get('window').width * 0.8,
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
  canceledModalTitleTxt: {
    color: 'white',
    fontWeight: '500',
  },
  canceledByContainer: {
    flexDirection: 'row',
    marginTop: 10,
    width: Dimensions.get('window').width * 0.4,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  canceledByTitle: {
    fontWeight: '500',
    fontSize: 17
  },
  canceledByData: {
    color: '#FEC631',
    fontWeight: '500',
    fontSize: 17
  },
  cancelReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: Dimensions.get('window').width * 0.9,
    marginTop: 10,
  },
  cancelReasonTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  cancelReasonDataContainer: {
    marginLeft: 10,
  },
  cancelReasonData: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FEC631'
  },
  canceledModalBtn: {
    backgroundColor: '#FEC631',
      borderRadius: 30,
      padding: 10,
      marginTop: 15,
      alignItems: 'center',
      justifyContent: 'center',
      width: Dimensions.get('window').width * 0.5,
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
  canceledModalBtnTxt: {
    color: '#FFF',
      fontWeight: '500',
      fontSize: 13,
  },
deliveredModalContainer: {
  backgroundColor: '#fff',
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
delivredModalTitleContainer: {
  backgroundColor: '#FEC631',
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 10,
  width: Dimensions.get('window').width * 0.8,
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
delivredModalTitle: {
  color: 'white',
  fontWeight: '500',
},
delivredModalFirstLine: {
  alignItems: 'center',
  justifyContent: 'space-between',
  flexDirection: 'row',
  marginTop: 10,
  marginBottom: 5,
  height: Dimensions.get('window').width * 0.2,
  width: Dimensions.get('window').width * 0.68
},
restaurantInfoDelivredModal: {
  alignItems: 'center',
  justifyContent: 'center',
},
RName: {
  fontWeight: '500',
},
clientInfo: {
  backgroundColor: '#FFF',
  borderRadius: 30,
  padding: 8,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
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
clientInfoData: {
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 5,
},
clientInfoDataTxt: {
  fontWeight: '500'
},
pricesCalculationsContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  width: Dimensions.get('window').width * 0.77,
},
priceLine: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: '100%'
},
priceLineTxt: {
  fontWeight: '500',
  fontSize: 16
},
priceLineData: {
  color: '#FEC631',
  fontWeight: '500',
  fontSize: 16,
},
orderList: {
    padding: 5,
    marginTop: 5,
    maxHeight: Dimensions.get('window').width * 0.38,
  },
  orderContainer: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    width: Dimensions.get('window').width * 0.8,
    flexDirection: 'row',
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
  orderCount: {
    color: '#FEC631',
    fontWeight: '500',
    fontSize: 16,
  },
  orderName: {
    fontWeight: '500',
    fontSize: 16
  },
  orderPrice: {
    color: '#FEC631',
    fontWeight: '500',
    fontSize: 16
  },
  orderTotal: {
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
    marginTop: 6,
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
  RIconContainerOrderModal: {
    width: Dimensions.get('window').width * 0.11, // Responsive size
    height: Dimensions.get('window').width * 0.11,
    borderRadius: 50,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;