import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    View, Text, SafeAreaView, StyleSheet, ScrollView, 
    TouchableOpacity, Image, TextInput, Keyboard, 
    ActivityIndicator, StatusBar, Platform, Alert,Modal, TouchableWithoutFeedback
} from 'react-native';
import * as Location from 'expo-location'; // Ensure expo-location is installed
import * as Notifications from 'expo-notifications';
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, query, where, getDoc, addDoc, getDocs } from 'firebase/firestore';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../UserContext';
import { Dimensions} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { usePushNotifications } from '../usePushNotifications';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from "date-fns"; // Using date-fns for date formatting

const greyMapStyle = [
  {
      elementType: 'geometry',
      stylers: [{ color: '#E0E0E0' }],
  },
  {
      elementType: 'labels.icon',
      stylers: [{ visibility: 'off' }],
  },
  {
      elementType: 'labels.text.fill',
      stylers: [{ color: '#757575' }],
  },
  {
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#ffffff' }],
  },
  {
      featureType: 'administrative.land_parcel',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#BDBDBD' }],
  },
  {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#A9A9A9' }],
  },
  {
      featureType: 'road.arterial',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#616161' }],
  },
  {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#B2B2B2' }],
  },
];

const DriverHome = ({ route }) => {
    const navigation = useNavigation();
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState('');
    const [profilePictureLoading, setProfilePictureLoading] = useState('');
    const [profilePicture, setProfilePicture] = useState(null);
    const [uploading, setUploading] = useState(false);
    const user = auth.currentUser;
    const [activeView, setActiveView] = useState('home');
    const [wilaya, setWilaya] = useState(''); 
    const [isOn, setIsOn] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [locationSubscription, setLocationSubscription] = useState(null);
    const { expoPushToken, notification } = usePushNotifications();
    const data = JSON.stringify(notification, undefined, 2);
    const [isModalNewOrderVisible, setModalNewOrderVisible] = useState(false);
    const [orderId, setOrderId] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [isCanceledOrderModalVisible, setIsCanceledOrderModalVisible] = useState(false);
    const [isDeliveredOrderModalVisible, setIsDeliveredOrderModalVisible] = useState(false);
    const { shouldRefetchOrders } = route.params || {};
    const [OrderData, setOrderDataa] = useState([]);
    const [todayOrders, setTodayOrders] = useState('');
    const [todayOrdersCount, setTodayOrdersCount] = useState('000');
    const [todayProfit, setTodayProfit] = useState('000');
    const [orderData, setOrderData] = useState({
      restaurantLocation: null,
      clientLocation: null,
      deliveryFees: '',
      restaurantName: '',
      restaurantLogo: '',
      clientName: '',
      clientPhoneNumber: '',
      orderedItems: [],
      totalPrice: '',
      preOrderDocId: '',
      clientId: '',
      restaurantId: '',
      noteRestaurant: '',
      noteDriver: '',
  });

  useEffect(() => {
    // Listen for when a notification is received while the app is open
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification received:", JSON.stringify(notification, null, 2));
      
      // Access and set order data from the notification
      const data = notification.request.content.data;
      if (data) {
        setOrderData({
          restaurantLocation: data.restaurantLocation,
          clientLocation: data.clientLocation,
          deliveryFees: data.deliveryFees,
          restaurantLogo: data.restaurantLogo,
          clientName: data.clientName,
          clientPhoneNumber: data.clientPhoneNumber,
          orderedItems: data.orderedItems,
          totalPrice: data.totalPrice,
          restaurantName: data.restaurantName,
          preOrderDocId: data.preOrderId,
          clientId: data.clientId,
          restaurantId: data.restaurantId,
          noteRestaurant: data.noteRestaurant,
          noteDriver: data.noteDriver,
        });
      } else {
        console.error("Data is undefined.");
      }
    });
  
    // Listen for when a notification response (click) is received
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notification response received:", JSON.stringify(response, null, 2));
      
      // Access data from the response and set it
      const data = response.notification.request.content.data;
      if (data) {
        setOrderData({
          restaurantLocation: data.restaurantLocation,
          clientLocation: data.clientLocation,
          deliveryFees: data.deliveryFees,
          restaurantLogo: data.restaurantLogo,
          clientName: data.clientName,
          clientPhoneNumber: data.clientPhoneNumber,
          orderedItems: data.orderedItems,
          totalPrice: data.totalPrice,
          restaurantName: data.restaurantName,
          preOrderDocId: data.preOrderId,
          clientId: data.clientId,
          restaurantId: data.restaurantId,
          noteRestaurant: data.noteRestaurant,
          noteDriver: data.noteDriver,
        });
        setModalNewOrderVisible(true); // Show modal when notification is tapped
      } else {
        console.error("Data is undefined.");
      }
    });
  
    // Cleanup listeners on component unmount
    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);
  
  const handleAcceptOrder = async () => {
    try {
        const newOrderData = {
            clientId: orderData.clientId || '',
            restaurantId: orderData.restaurantId || '',
            driverId: userId || '',
            clientLocation: orderData.clientLocation || null,
            wilaya: wilaya || '',
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
            orderedItems: orderData.orderedItems || [],
            deliveryFees: orderData.deliveryFees || '',
            status: 'Active',
            orderStatus: 'Picked Up',
            noteDriver: orderData.noteDriver || '',
            noteRestaurant: orderData.noteRestaurant || '',
            totalPrice: orderData.totalPrice || '',
        };

        const orderDocRef = await addDoc(collection(db, 'orders'), newOrderData);
        const preOrderRef = doc(db, 'preOrder', orderData.preOrderDocId);
        setOrderId(orderDocRef.id);
        await updateDoc(preOrderRef, {
            response: 'accepted',
            orderId: orderDocRef.id,
        });
        fetchOrders();
        setModalNewOrderVisible(false); 
        // Pass orderId as a parameter to the DriverActiveOrder screen
        navigation.navigate('DriverActiveOrder', { orderId: orderDocRef.id });
    } catch (error) {
        console.error('Error accepting order:', error);
        Alert.alert('Error', 'There was an error accepting the order. Please try again.');
    }
};

const handleRefuseOrder = async () => {
    try {
        const orderRef = doc(db, 'preOrder', orderData.preOrderDocId); // Adjust the path to your orders collection
        await updateDoc(orderRef, { response: 'declined' }); // Update the order status to declined
        setModalNewOrderVisible(false); // Close the modal
        Alert.alert('Order Declined', 'You have declined the order.');
    } catch (error) {
        console.error('Error declining order:', error);
        Alert.alert('Error', 'There was an error declining the order. Please try again.');
    }
};


  const calculateRegion = () => {
    if (orderData.restaurantLocation && orderData.clientLocation && userLocation) {
        const restaurantCoords = {
            latitude: orderData.restaurantLocation[1],
            longitude: orderData.restaurantLocation[0],
        };
        const clientCoords = {
            latitude: orderData.clientLocation.latitude,
            longitude: orderData.clientLocation.longitude,
        };
        const driverCoords = {
            latitude: userLocation[1],
            longitude: userLocation[0],
        };

        // Collect all coordinates
        const latitudes = [
            restaurantCoords.latitude,
            clientCoords.latitude,
            driverCoords.latitude,
        ];
        const longitudes = [
            restaurantCoords.longitude,
            clientCoords.longitude,
            driverCoords.longitude,
        ];

        // Calculate the deltas
        const latitudeDelta = Math.abs(Math.max(...latitudes) - Math.min(...latitudes)) * 1.5;
        const longitudeDelta = Math.abs(Math.max(...longitudes) - Math.min(...longitudes)) * 1.5;

        return {
            latitude: (Math.max(...latitudes) + Math.min(...latitudes)) / 2,
            longitude: (Math.max(...longitudes) + Math.min(...longitudes)) / 2,
            latitudeDelta,
            longitudeDelta,
        };
    }
    
    // Default return if any location data is missing
    return {
        latitude: orderData.restaurantLocation ? orderData.restaurantLocation[1] : 0,
        longitude: orderData.restaurantLocation ? orderData.restaurantLocation[0] : 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };
};


const initialRegion = calculateRegion();

const toggleOnOff = async () => {
  const newStatus = !isOn ? 'online' : 'offline';
  setIsOn(!isOn);

  if (userId) {
      const userRef = doc(db, 'users', userId);

      // Update the user's status in Firestore
      await updateDoc(userRef, {
          status: newStatus,
          wilaya: wilaya,
      });

      if (newStatus === 'online') {
          await getLocation(userRef); // Initial location fetch
          trackLocation(userRef);     // Start tracking
      } else if (newStatus === 'offline') {
          stopTrackingLocation();     // Stop tracking when offline
      }
  }
};

  const trackLocation = async (userRef) => {
    // Ensure we only set a new subscription if one doesn't already exist
    if (locationSubscription) {
        return;
    }

    const subscription = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 5000,
            distanceInterval: 10,
        },
        async (location) => {
            const { latitude, longitude } = location.coords;
            try {
                await updateDoc(userRef, { location: [longitude, latitude] });
                // Use callback form of setState to ensure the latest value
                setUserLocation((prevLocation) => {
                    const newLocation = [longitude, latitude];
                    return newLocation;
                });
            } catch (error) {
                console.error('Error updating location:', error);
            }
        }
    );

    setLocationSubscription(subscription);
};


const stopTrackingLocation = () => {
  if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
      console.log('Location tracking stopped');
  }
};

const getLocation = useCallback(async (userRef) => {
    try {
        const locationServicesEnabled = await Location.hasServicesEnabledAsync();
        if (!locationServicesEnabled) {
            Alert.alert('Location Services Disabled', 'Please enable location services to continue using the app.');
            return;
        }

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Permission to access location was denied');
            setWilaya('Unknown');
            return;
        }

        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = location.coords;

        console.log('Location obtained:', latitude, longitude);
        let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode.length > 0) {
            let region = geocode[0].region?.trim() || geocode[0].subregion?.trim() || 'Unknown';
            const wilayas = ['Tiaret', 'Alger', 'Chlef', 'Oran', 'Tlemcen'];
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

const fetchUserData = useCallback(async () => {
  if (user) {
      try {
          setProfilePictureLoading(true);
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              const userData = userSnap.data();
              setIsOn(userData.status === 'online');
              setUserName(`${userData.name} ${userData.surname}`);
              setRole(`${userData.role}`);
              setProfilePicture(userData.profilePicture);
              setProfilePictureLoading(false);
              setUserId(user.uid);
          }
      } catch (error) {
          console.error('Error fetching user data: ', error);
      }
  }
}, [user]);

useEffect(() => {
  const updateNotificationToken = async () => {
      if (userId && expoPushToken) {
          try {
              const userDocRef = doc(db, 'users', userId);
              await updateDoc(userDocRef, { notificationToken: expoPushToken });
              console.log('Notification token saved to Firestore:', expoPushToken);
          } catch (error) {
              console.error('Error saving notification token:', error);
          }
      } else {
          console.log('Waiting for both userId and expoPushToken to be set...');
      }
  };

  updateNotificationToken();
}, [userId, expoPushToken]); 

useEffect(() => {
    fetchUserData();
    getLocation();
    return () => stopTrackingLocation();
}, [fetchUserData, getLocation]);

const fetchOrders = async (status = null) => {
  try {
    setLoading(true);
    let ordersQuery;

    if (status) {
      ordersQuery = query(collection(db, 'orders'), where('status', '==', status));
    } else {
      ordersQuery = query(collection(db, 'orders')); // Fetch all orders if no status is selected
    }

    const ordersSnapshot = await getDocs(ordersQuery);
    const ordersData = [];
    const todayOrders = [];
    const todayDate = format(new Date(), "dd/MM/yyyy"); // Format today's date to match order date format

    for (const orderDoc of ordersSnapshot.docs) {
      const orderData = orderDoc.data();
      const clientDoc = await getDoc(doc(db, 'users', orderData.clientId));
      const restaurantDoc = await getDoc(doc(db, 'Wilayas', orderData.wilaya, 'Restaurants', orderData.restaurantId));

      const completeOrder = {
        ...orderData,
        client: clientDoc.exists() ? clientDoc.data() : null,
        restaurant: restaurantDoc.exists() ? restaurantDoc.data() : null,
        id: orderDoc.id,
      };

      // Push each order to the main orders array
      ordersData.push(completeOrder);

      // Check if the order date is today, and if so, push it to today's orders array
      if (orderData.date === todayDate) {
        todayOrders.push(completeOrder);
      }
      if (todayOrders.length > 0) {
        const todayProfit = todayOrders
          .filter(order => order.status === "Delivered")
          .reduce((total, order) => total + (order.deliveryFees || 0), 0);
          if (todayProfit > 0){
            setTodayProfit(todayProfit);
          }
      }
    }

    setOrders(ordersData);
    setTodayOrders(todayOrders);
    setTodayOrdersCount(todayOrders.length);
    
    
  } catch (error) {
    console.error("Error fetching orders: ", error);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchOrders();
}, []);

// Button press handler to toggle order status
const handleStatusChange = (status) => {
  if (selectedStatus === status) {
      setSelectedStatus(null); // Reset filter if the button is rechecked
      fetchOrders();
  } else {
      setSelectedStatus(status);
      fetchOrders(status);
  }
};
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
  } else if (status === 'Active') {
      return (
        <View style={styles.activeStatusContainer}>
          <Text style={styles.statusText}>Active</Text>
        </View>
      );
  }
};

const handleTabChange = (view) => {
  setActiveView(view);
};

const handleLogout = async () => {
  try {
      await signOut(auth);
      await AsyncStorage.removeItem('user'); // Clear user from AsyncStorage
      navigation.replace('Login'); // Navigate to login screen
  } catch (error) {
      console.error('Error signing out: ', error);
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

const handleOrderCardClick = (status, id, order) => {
  if (status === 'Canceled') {
        setOrderDataa(order);
        setIsCanceledOrderModalVisible(true);
  } else if (status === 'Delivered') {
        setOrderDataa(order);
        setIsDeliveredOrderModalVisible(true);
  } else if (status === 'Active') {
      navigation.navigate('DriverActiveOrder', { orderId: id });
  }
};

useFocusEffect(
  useCallback(() => {
    if (shouldRefetchOrders) {
      fetchOrders();
    }
  }, [shouldRefetchOrders])
);

  return (
    <SafeAreaView style={styles.container}>
    {activeView === 'home' && (  
        <>
        <View style={styles.viewContainer}>
        <View style={styles.SearchBarContainer}>
            <TouchableOpacity style={styles.roundButton} onPress={handleLogout}>
              <Image style={styles.locationIcon} source={require('../assets/logout.png')} />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Text style={styles.PlaceHText}>
                <Text style={styles.boldText}>{userName || 'Guest'}</Text>
              </Text>
            </View>
          </View><View style={styles.widgetContainer}>
            <TouchableOpacity
              style={[styles.onOffWidget, isOn && styles.onWidgetActive]} // Apply conditional styling
              onPress={toggleOnOff}
            >
              <View style={styles.onOffFirstLine}>
                <Text style={[styles.onOffText, isOn && styles.onOffTextActive]}>
                  {isOn ? 'On' : 'Off'}
                </Text>
                <Text style={[styles.wilayaTxt, isOn && styles.onOffTextActive]}>
                  {wilaya || 'Unknown'}
                </Text>
              </View>
              <Image
                source={require('../assets/pin.png')}
                style={[styles.onOffwidgetIcon, isOn && { tintColor: '#fff' }]} />
            </TouchableOpacity>
            <View style={styles.secondWidget}>
              <View style={styles.todayProfit}>
                <View style={styles.todayProfitFirstLine}>
                  <Text style={styles.todayProfitCount}>{todayProfit}</Text>
                  <Image style={styles.DZDicon}
                    source={require('../assets/currency.png')} />
                </View>
                <Text style={styles.todayProfitTitle}>Today profit</Text>
              </View>
              <View style={styles.todayDeliveries}>
                <View style={styles.todayDeliveriesFirstLine}>
                  <Text style={styles.todayDeliveriesCount}>0{todayOrdersCount}</Text>
                  <Image style={styles.DeliveriesIcon}
                    source={require('../assets/package-box.png')} />
                </View>
                <Text style={styles.todayDeliveriesTitle}>Today deliveries</Text>
              </View>
            </View>
          </View><View style={styles.todayDeliveriesListContainer}>
            <View style={styles.todayOrdersTitleContainer}>
              <Text style={styles.todayOrdersTitle}>Today orders</Text>
            </View>
            <View style={styles.Hmenu}>
              <TouchableOpacity
                style={[
                  styles.HmenuBtn,
                  selectedStatus === 'Active' && styles.selectedButton
                ]}
                onPress={() => handleStatusChange('Active')}
              >
                <Text style={[styles.HmenuBtnTxt, selectedStatus === 'Active' && styles.selectedButtonText]}>
                  Active
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.HmenuBtn,
                  selectedStatus === 'Delivered' && styles.selectedButton
                ]}
                onPress={() => handleStatusChange('Delivered')}
              >
                <Text style={[styles.HmenuBtnTxt, selectedStatus === 'Delivered' && styles.selectedButtonText]}>
                  Delivered
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.HmenuBtn,
                  selectedStatus === 'Canceled' && styles.selectedButton
                ]}
                onPress={() => handleStatusChange('Canceled')}
              >
                <Text style={[styles.HmenuBtnTxt, selectedStatus === 'Canceled' && styles.selectedButtonText]}>
                  Canceled
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
               {loading ? (
                 <View style={styles.loadingContainer}>
                   <ActivityIndicator size="large" color="#FEC631" />
                 </View>
               ) : todayOrders.length > 0 ? (
                 todayOrders
                   .sort((a, b) => {
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
                             {order.client?.name} {order.client?.surname}
                          </Text>
                          
                       </View>
                       <View style={styles.div3}>
                         <Text style={styles.fees}>{order?.deliveryFees} DA</Text>
                         {renderStatusContainer(order.status)}
                       </View>
                     </TouchableOpacity>
                   ))
               ) : (
                 <View style={styles.viewContainer}>
                   <Image 
                     style={styles.orderSketch}
                     source={require('../assets/undraw_shopping_app_flsj.png')}
                   />
                   <Text style={styles.FavoritesTxt}>You haven't received any orders yet</Text>
                  </View>
                )}
              </ScrollView>

          </View>
          <Modal visible={isModalNewOrderVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.newOrderModal}>
                <View style={styles.MapContainer}>
                  <MapView
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={initialRegion}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    customMapStyle={greyMapStyle}
                  >
                    {orderData.restaurantLocation && (
                      <Marker
                        coordinate={{
                          latitude: orderData.restaurantLocation[1],
                          longitude: orderData.restaurantLocation[0],
                        }}
                      >
                        <View style={styles.markerContainer}>
                          <View style={styles.markerBackground}>
                            <Image
                              source={{ uri: orderData.restaurantLogo }}
                              style={styles.markerImage}
                              resizeMode="contain" />
                          </View>
                          <View style={styles.pinTriangle} />
                        </View>
                      </Marker>
                    )}

                    {orderData.clientLocation && (
                      <Marker
                        coordinate={{
                          latitude: orderData.clientLocation.latitude,
                          longitude: orderData.clientLocation.longitude,
                        }}
                        title="Client Location"
                        description={orderData.clientName}
                      >
                        <View style={styles.markerContainer}>
                          <View style={styles.markerBackground}>
                            <Image
                              source={require('../assets/user-11.png')}
                              style={styles.markerImage}
                              resizeMode="contain" />
                          </View>
                          <View style={styles.pinTriangle} />
                        </View>
                      </Marker>
                    )}
                    <Marker
                      coordinate={{
                        latitude: userLocation ? userLocation[1] : 0,
                        longitude: userLocation ? userLocation[0] : 0,
                      }}
                      title="Driver Location"
                      description={userName}
                    >
                      <View style={styles.markerContainer}>
                        <View style={styles.markerDriverBackground}>
                          <Image
                            source={require('../assets/vespa.png')}
                            style={styles.markerDriverImage}
                            resizeMode="contain" />
                        </View>
                        <View style={styles.pinTriangle} />
                      </View>
                    </Marker>
                  </MapView>
                </View>
                <View style={styles.newOrderModalFirstLine}>
                  <Text style={styles.feesTxt}>{orderData.deliveryFees} DA</Text>
                  <View style={styles.restaurantInfo}>
                    <View style={styles.RIconContainerOrderModal}>
                      <Image style={styles.IconCard} source={{ uri: orderData.restaurantLogo }} />
                    </View>
                    <Text style={styles.restaurantName}>{orderData.restaurantName}</Text>
                  </View>
                </View>
                <View style={styles.newOrderModalSecondLine}>
                  <Text style={styles.clientName}>{orderData.clientName}</Text>
                  <Text style={styles.clientPhoneNumber}>{orderData.clientPhoneNumber}</Text>
                </View>
                <ScrollView style={styles.orderList} showsVerticalScrollIndicator={false}>
                  {orderData.orderedItems.map((item, index) => (
                    <View style={styles.orderContainer} key={index}>
                      <Text style={styles.orderCount}>{item.count}</Text>
                      <Text style={styles.orderName}>{item.itemName}</Text>
                      <Text style={styles.orderPrice}>{item.price} DA</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.orderTotal}>
                  <Text style={styles.totalTitle}>Total: </Text>
                  <Text style={styles.totalOrder}>{orderData.totalPrice} DA</Text>
                </View>
                <View style={styles.newOrderModalBtns}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptOrder}>
                    <Text style={styles.acceptBtnTxt}>Accept order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.refuseBtn} onPress={handleRefuseOrder}>
                    <Image style={styles.Back} source={require('../assets/cross.png')} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Modal visible={isCanceledOrderModalVisible} transparent animationType="slide">
            <TouchableWithoutFeedback onPress={() => setIsCanceledOrderModalVisible(false)}>
              <View style={styles.modalOrderOverlay}>
              <TouchableWithoutFeedback>
                   <View style={styles.canceledModalContainer}>
                     <View style={styles.canceledModalTitle}>
                        <Text style={styles.canceledModalTitleTxt}>{OrderData?.status}</Text>
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
                                                      <Text style={styles.clientInfoDataTxt}>{OrderData.client?.name} {OrderData.client?.surname}</Text>
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
        </View>
          </>
    )}

{activeView === 'menu' && (
                <View style={styles.viewContainer}>
                 {loading ? (
                   <ActivityIndicator size="large" color="#FEC635" />
                 ) : (
                   <>
                     {/* If the user has made orders, show them */}
                     {orders.length > 0 ? (
                        <><View style={styles.headercontainer}>
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
                                                      {order.client?.name} {order.client?.surname}
                                                   </Text>

                                                </View>
                                                <View style={styles.div3}>
                                                  <Text style={styles.fees}>{order?.deliveryFees} DA</Text>
                                                  {renderStatusContainer(order.status)}
                                                </View>
                                              </TouchableOpacity>
                                            ))}
                                        </ScrollView>
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
                                                      <Text style={styles.clientInfoDataTxt}>{OrderData.client?.name} {OrderData.client?.surname}</Text>
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
                         <Image 
                           style={styles.orderSketch}
                           source={require('../assets/undraw_shopping_app_flsj.png')}
                         />
                         <Text style={styles.FavoritesTxt}>You haven't received any orders yet</Text>
                       </View>
                      )}
                    </>
                  )}
                </View>
                )}
    <View style={styles.footerMenu}>
            <TouchableOpacity style={styles.footerButton} onPress={() => { handleTabChange('home');}}>
              <Image style={styles.footerIcon} source={require('../assets/home.png')} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton}>
              <Image style={styles.footerIcon} source={require('../assets/cost-effectiveness-2.png')} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={() => { handleTabChange('menu');}}>
              <Image style={styles.footerIcon} source={require('../assets/menu.png')}/>
            </TouchableOpacity>
    </View>
    </SafeAreaView>
  )
}

export default DriverHome

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      },
      viewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
      locationIcon: {
        height: Dimensions.get('window').width * 0.07,
        width: Dimensions.get('window').width * 0.07,
      },
    headercontainer: {
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
    headerText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    headerTextOrders: {
      fontWeight: 'bold',
      fontSize: 16,
  },
    widgetContainer: {
        paddingTop: 10,
        flexDirection: 'row',
        marginLeft: 9,
        
    },
    onOffWidget: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: Dimensions.get('window').width * 0.33,
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
    onWidgetActive: {
        backgroundColor: '#FEC631',
    },
    onOffTextActive: {
        color: 'white',
    },
    onOffText: {
        fontWeight: '500',
        marginBottom: 10,
    },
    wilayaTxt: {
        fontWeight: '500'
    },
    secondWidget: {
        backgroundColor: '#fff',
        borderRadius: 30,
        marginHorizontal: 10,
        padding: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: Dimensions.get('window').width * 0.59,
        height: Dimensions.get('window').width * 0.23,
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
    todayProfit: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderColor: '#FEC631',
        width: Dimensions.get('window').width * 0.24,
    },
    todayProfitFirstLine: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    todayProfitCount: {
        fontWeight: '500',
    },
    DZDicon: {
        marginLeft: 5
    },
    todayProfitTitle: {
        fontWeight: '500'
    },
    todayDeliveries: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    todayDeliveriesFirstLine: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    todayDeliveriesCount: {
        fontWeight: '500'
    },
    DeliveriesIcon: {
        marginLeft: 7,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      height: Dimensions.get('window').width * 1.40,
      marginTop: 3
    },
    todayDeliveriesListContainer: {
      height: Dimensions.get('window').width * 1.46,
    },
    todayDeliveriesTitle: {
        fontWeight: '500'
    },
    todayOrdersTitleContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 20,
    },
    todayOrdersTitle: {
      fontSize: 20,
      fontWeight: '500',
    },
    Hmenu: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      marginBottom: 5,
    },
    HmenuBtn: {
      backgroundColor: '#fff',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        flexDirection: 'row',
        paddingHorizontal: 15,
        padding: 10,
        height: Dimensions.get('window').width * 0.13,
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
    selectedButton: {
      backgroundColor: '#FEC631',
    },
    selectedButtonText: {
      color: 'white',
    },
    HmenuBtnTxt: {
      fontWeight: '400',
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
    
    orderCardFirstLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    div3: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    RIconContainer: {
      width: Dimensions.get('window').width * 0.11, // Responsive size
      height: Dimensions.get('window').width * 0.11,
      borderRadius: 50,
      overflow: 'hidden',
      marginTop: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    RIconContainerCard: {
      width: Dimensions.get('window').width * 0.2, // Responsive size
      height: Dimensions.get('window').width * 0.2,
      borderRadius: 50,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    IconCard: {
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
      }),
    },
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
      }),
    },
    statusText: {
      color: 'white',
    },
    orderCardsecondLine: {
      alignItems: 'center',
      width: Dimensions.get('window').width * 0.61,
    },
    clientName: {
     fontWeight: '500'
    },
    orderCardThirdLine: {
      marginLeft: 45,
      marginTop: 5,
    },
    orderDatendTime: {
      fontWeight: '500'
    },
    div2: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    fees: {
      color: '#FEC631',
      fontSize: 25,
      fontWeight: 'bold'
    },
    footerMenu: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: '#DDD',
      backgroundColor: '#FFF',
      paddingBottom: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    footerButton: {
        alignItems: 'center',
    },
    footerIcon: {
        width: 30,
        height: 30,
    },
    modalOverlay: {
      justifyContent: 'center',
      alignItems: 'center',
      flex: 1
    },
    newOrderModal: {
      backgroundColor: '#fff',
      width: Dimensions.get('window').width * 0.90,
      height: Dimensions.get('window').width * 1.30,
        borderRadius: 30,
        marginHorizontal: 10,
        marginTop: 10,
        marginBottom: 10,
      alignItems: 'center',
        // iOS shadow styles
        ...(Platform.OS === 'ios' && {
          shadowColor: '#FEC631',
          shadowOpacity: 0.8,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        }),
        // Android elevation style
        ...(Platform.OS === 'android' && {
            elevation: 20, // Adjust elevation value as needed
        }),
    },
    MapContainer: {
      width: Dimensions.get('window').width * 0.85,
      height: Dimensions.get('window').width * 0.37,
      marginHorizontal: 13,
      marginVertical: 10,
      borderRadius: 25,
      backgroundColor: 'white',
      overflow: 'hidden',
      ...(Platform.OS === 'ios' && {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
      }),
      ...(Platform.OS === 'android' && {
        elevation: 5,
      }),
    },
    orderTitleTxt: {
      fontSize: 25,
      fontWeight: 'bold',
      marginRight: 230,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    markerContainer: {
      alignItems: 'center',
    },
    markerBackground: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#FEC631',
      justifyContent: 'center',
      alignItems: 'center',
    },
    markerDriverBackground: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#FFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    markerImage: {
      width: Dimensions.get('window').width * 0.12, // Responsive size
      height: Dimensions.get('window').width * 0.12,
      borderRadius: 25,
    },
    markerDriverImage: {
      width: Dimensions.get('window').width * 0.12, // Responsive size
      height: Dimensions.get('window').width * 0.12,
      borderRadius: 25,
    },
    pinTriangle: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderBottomWidth: 15,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: '#FEC631',
      alignSelf: 'center',
      marginTop: -2, 
      transform: [{ rotate: '180deg' }],
    },
    newOrderModalFirstLine: {
      marginTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: Dimensions.get('window').width * 0.8,
      alignItems: 'center',
    },
    feesTxt: {
      color: '#FEC631',
      fontSize: 30,
      fontWeight: 'bold',
      marginLeft: 10
    },
    restaurantInfo: {
      backgroundColor: '#fff',
      borderRadius: 30,
      padding: 5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
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
    newOrderModalSecondLine: {
      marginTop: 10,
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: Dimensions.get('window').width * 0.8,
      alignItems: 'center',
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
  totalTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  totalOrder: {
      color: '#FEC631',
      fontSize: 15,
      fontWeight: '500'
    },
    newOrderModalBtns: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      width: Dimensions.get('window').width * 0.7,
      marginBottom: 15
    },
    acceptBtn: {
      backgroundColor: '#FEC631',
      borderRadius: 30,
      padding: 10,
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
    acceptBtnTxt: {
      color: '#FFF',
      fontWeight: '500',
      fontSize: 13,
    },
    refuseBtn: {
      backgroundColor: '#FFF',
      borderRadius: 75,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
      width: Dimensions.get('window').width * 0.13,
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
  width: Dimensions.get('window').width * 0.67,
  height: Dimensions.get('window').width * 0.2,
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
  fontSize: 16
},
  /*Profile Styles*/////////////////////////////////////////////////////////////////////////////////////
  profileContainer: {
    height: '100%',
    width: '100%',
    paddingVertical: 50,
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
  boldText4: {
      fontWeight: 'bold',
  },
  orderSketch: {
    width: Dimensions.get('window').width * 0.90,
    height: Dimensions.get('window').width * 0.90,
  },
  FavoritesTxt: {
    fontSize: 19,
    fontWeight: '500',
  },
})