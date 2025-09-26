import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,Platform, StatusBar, Modal, Alert, KeyboardAvoidingView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ScrollView, TextInput } from 'react-native-gesture-handler';
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, getDocs, query, where, doc, setDoc, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location'; // Import Expo Location
import haversine from 'haversine-distance';
import { usePushNotifications } from '../usePushNotifications';

// Function to calculate delivery fee based on distance and night time
function calculateDeliveryFee(distance, isNight) {
  let fee = 0;

  // Calculate base fee based on distance
  if (distance <= 2) {
    fee = 150;
  } else if (distance <= 4) {
    fee = 200;
  } else if (distance <= 6) {
    fee = 250;
  } else if (distance <= 9) {
    fee = 300;
  } else {
    fee = 400;
  }

  // Add additional 30 DA fee if it's night
  if (isNight) {
    fee += 30;
  }

  return fee;
}

// Function to check if it's night time
function isNightTime() {
  const currentHour = new Date().getHours();
  return currentHour >= 22 || currentHour < 6; // Between 10 PM and 6 AM
}

const OrderDetailsClient = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { restaurantName, orderedItems, restaurantLocation, restaurantLogo, wilaya, restaurantId, totalPrice } = route.params; // restaurantLocation: [longitude, latitude]
  const [userName, setUserName] = useState('');
  const [noteRestaurant, setNoteRestaurant] = useState('');
  const [noteDriver, setNoteDriver] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [deliveryFees, setDeliveryFees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(null);
  const user = auth.currentUser;
  const [isModalDriverVisible, setModalDriverVisible] = useState(false);
  const [isModalNoteDriverVisible, setModalNoteDriverVisible] = useState(false);
  const [isModalNoteRestaurantVisible, setModalNoteRestaurantVisible] = useState(false);
  const { sendPushNotification } = usePushNotifications();
  const [driverResponse, setDriverResponse] = useState(null);
  const [preOrderId, setPreOrderId] = useState(null);
  const [driverQueue, setDriverQueue] = useState([]);
  const [userId, setUserId] = useState(null);
  const [orderId, setOrderId] = useState('');

  const fetchAvailableDrivers = async () => {
    setModalDriverVisible(true);
    try {
      // Create a new preOrder document with 'waiting' status
      const preOrderRef = collection(db, 'preOrder');
      const preOrderDoc = doc(preOrderRef);
      await setDoc(preOrderDoc, { response: 'waiting' });
      setPreOrderId(preOrderDoc.id);
  
      // Fetch online drivers in the specified region
      const driversRef = collection(db, 'users');
      const driversQuery = query(
        driversRef,
        where('role', '==', 'Driver'),
        where('status', '==', 'online'),
        where('wilaya', '==', wilaya)
      );
  
      const querySnapshot = await getDocs(driversQuery);
      const driversWithDistance = [];
  
      const restaurantLoc = {
        latitude: restaurantLocation[1],
        longitude: restaurantLocation[0],
      };
  
      // Calculate distance to each driver and sort by proximity
      querySnapshot.forEach((doc) => {
        const driverData = doc.data();
        if (driverData.location) {
          const driverLoc = {
            latitude: driverData.location[1],
            longitude: driverData.location[0],
          };
          const distance = haversine(driverLoc, restaurantLoc) / 1000;
          driversWithDistance.push({ ...driverData, distance, id: doc.id });
        }
      });
  
      driversWithDistance.sort((a, b) => a.distance - b.distance);
  
      // Function to send notifications to drivers in sequence
      const sendNotificationToNextDriver = async (index) => {
        if (index >= driversWithDistance.length) {
          setModalDriverVisible(false);
          Alert.alert('No driver available', 'Try again later.');
          return;
        }
  
        const driver = driversWithDistance[index];
        await sendPushNotification(
          driver.id,
          "New Order Available",
          "You have a new delivery order to accept.",
          {
            restaurantLocation: restaurantLocation,
            clientLocation: userLocation,
            deliveryFees: deliveryFees,
            restaurantLogo: restaurantLogo,
            clientName: userName,
            clientPhoneNumber: phoneNumber,
            orderedItems: orderedItems,
            totalPrice: totalPrice,
            restaurantName: restaurantName,
            preOrderId: preOrderDoc.id,
            clientId: userId,
            restaurantId: restaurantId,
            noteRestaurant: noteRestaurant,
            noteDriver: noteDriver,
          }
        );
        console.log(`Notification sent to driver: ${driver.name || "Unnamed"}`);
  
        // Listen for the driver's response
        const unsubscribe = onSnapshot(doc(db, 'preOrder', preOrderDoc.id), (doc) => {
          const data = doc.data();
          if (data.response === 'accepted') {
            setModalDriverVisible(false);
            navigation.navigate('Home', { shouldRefetchOrders: true });
            Alert.alert('Order Accepted', 'Your order has been accepted.');
            unsubscribe();
          } else if (data.response === 'declined') {
            unsubscribe();
            sendNotificationToNextDriver(index + 1); // Notify the next driver
          }
        });
      };
  
      if (driversWithDistance.length > 0) {
        sendNotificationToNextDriver(0); // Start with the closest driver
      } else {
        setModalDriverVisible(false);
        Alert.alert('No driver available', 'Try again later.');
      }
    } catch (error) {
      console.error('Error fetching drivers: ', error);
    }
  };
  
  // Simplified useEffect to only monitor for an accepted response
  useEffect(() => {
    if (preOrderId) {
      const preOrderDocRef = doc(db, 'preOrder', preOrderId);
      const unsubscribe = onSnapshot(preOrderDocRef, (doc) => {
        const data = doc.data();
        if (data && data.response === 'accepted') {
          setOrderId(data.orderId);
          setModalDriverVisible(false);
          navigation.navigate('ActiveOrderDriver');
          console.log('orderId:', orderId)
        }
      });
      return () => unsubscribe();
    }
  }, [preOrderId]);
  

  // Fetch user data from Firestore
  const fetchUserData = useCallback(async () => {
    if (user) {
      try {
        const userRef = collection(db, 'users');
        const querySnapshot = await getDocs(userRef);
        querySnapshot.forEach(doc => {
          const userData = doc.data();
          if (userData.email === user.email) {
            setUserName(`${userData.name} ${userData.surname}`);
            setPhoneNumber(userData.phoneNumber);
            setUserId(doc.id);
          }
        });
      } catch (error) {
        console.error('Error fetching user data: ', error);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Fetch user location and calculate distance
  useEffect(() => {
    const fetchLocationAndCalculateDistance = async () => {
      // Request location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to access location was denied');
        setLoading(false);
        return;
      }

      // Get current position
      let location = await Location.getCurrentPositionAsync({});
      const userLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(userLoc);

      const restaurantLoc = {
        latitude: restaurantLocation[1],
        longitude: restaurantLocation[0],
      };

      // Calculate distance using the Haversine formula
      const distanceInMeters = haversine(userLoc, restaurantLoc);
      const distanceInKm = distanceInMeters / 1000;

      // Check if it's night time
      const nightTime = isNightTime();

      // Calculate delivery fee using the provided logic
      const calculatedFees = calculateDeliveryFee(distanceInKm, nightTime);
      setDeliveryFees(calculatedFees); // Set delivery fees
      setLoading(false);

      // Print to console
      console.log(`User Location: ${JSON.stringify(userLoc)}`);
      console.log(`Restaurant Location: ${JSON.stringify(restaurantLoc)}`);
      console.log(`Distance: ${distanceInKm.toFixed(2)} km`);
      console.log(`Delivery Fees: ${calculatedFees} DA`);
    };

    if (restaurantLocation) {
      const [longitude, latitude] = restaurantLocation;
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005, // Zoom level
        longitudeDelta: 0.01 * (Dimensions.get('window').width / Dimensions.get('window').height),
      });
      fetchLocationAndCalculateDistance();
    }
  }, [restaurantLocation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} justifyContent= 'center'>
        <ActivityIndicator size="large" color="#FFD21F" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.SearchBarContainer}>
        <TouchableOpacity
          style={styles.roundButton}
          onPress={() => navigation.navigate('Menu', {
            wilaya,
            restaurantId
          })}
        >
          <Image style={styles.Back} source={require('../assets/back.png')} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Text style={styles.boldText}>Order Details</Text>
        </View>
      </View>
     <ScrollView showsVerticalScrollIndicator= {false}>     
      <View style={styles.MapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          scrollEnabled={false} 
          zoomEnabled={false}  
          rotateEnabled={false} 
          pitchEnabled={false}
        >
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerBackground}>
                <Image
                  source={{ uri: restaurantLogo }}
                  style={styles.markerImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.pinTriangle} />
            </View>
          </Marker>
        </MapView>
      </View>
      <View style={styles.DeliveryInfo}>
        <Text style={styles.DeliveryInfoTitle}>Delivery informations</Text>
        <View style={styles.NameParentContainer}>
          <Image style={styles.NameLogo}
            source={require('../assets/people.png')}
          />
          <View style={styles.NameChildContainer}>
            <Text style={styles.NameTxt}>Name</Text>
            <Text style={styles.nameContent}>{userName || 'Guest'}</Text>
          </View>
        </View>
        <View style={styles.PhoneParentContainer}>
          <Image style={styles.PhoneLogo}
            source={require('../assets/mobile-phone.png')}
            />
          <View style={styles.PhoneChildContainer}>
            <Text style={styles.PhoneTxt}>Phone Number</Text>
            <Text style={styles.phoneContent}>{phoneNumber || 'Guest'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.OrderInfo}>
        <Text style={styles.orderInfoTitle}>Order informations</Text>
        {orderedItems && orderedItems.length > 0 ? (
          orderedItems.map((item, index) => (
            <View key={index} style={styles.Item}>
              <Text style={styles.ItemCount}>{item.count}</Text>
              <Text style={styles.ItemName}>{item.itemName}</Text>
              <Text style={styles.ItemPrice}>{item.price} DA</Text>
            </View>
              ))
            ) : (
              <Text>No items ordered</Text>
            )}
        <TouchableOpacity style={styles.ResturantBtnNote} onPress={() => setModalNoteRestaurantVisible(true)}>
          <Image style={styles.NoteBtnImg}
                 source={require('../assets/wirte.png')}
          /> 
          <View> 
            <Text style={styles.ResturantNoteBtnTitle}>Note for the restaurant</Text>
            <Text style={styles.ResturantNoteBtnDescreption}>ex: no ketchup, medium grilled</Text>
          </View>  
        </TouchableOpacity>
        <TouchableOpacity style={styles.ResturantBtnNote} onPress={() => setModalNoteDriverVisible(true)}>
          <Image style={styles.NoteBtnImg}
                 source={require('../assets/wirte.png')}
          /> 
          <View> 
            <Text style={styles.ResturantNoteBtnTitle}>Note for the driver</Text>
            <Text style={styles.ResturantNoteBtnDescreption}>ex: leave me an sms when arrive </Text>
          </View>  
        </TouchableOpacity>    
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentInfoTitle}>Payment informations</Text>
        <View style={styles.paymentLine}>
          <Text style={styles.orderPriceTitle}>Order</Text>
          <Text style={styles.orderPrice}>{totalPrice} DA</Text>
        </View>
        <View style={styles.paymentLine}>
          <Text style={styles.deliveryFeesTitle}>Delivery fees</Text>
          <Text style={styles.deliveryFeesPrice}>{deliveryFees} DA</Text>
        </View>
        <View style={styles.paymentLine}>
          <Text style={styles.TotalPriceTitle}>Total price</Text>
          <Text style={styles.TotalPrice}>{(parseFloat(totalPrice) + parseFloat(deliveryFees))} DA</Text>
        </View>
      </View>
     </ScrollView>
      <View style={styles.confirmBtnContainer}>
        <TouchableOpacity  style={styles.confirmOrderBtn} onPress={fetchAvailableDrivers}>
                <Text style={styles.confirmBtnTxt}>Confirm order</Text>
        </TouchableOpacity>
      </View> 
      {/* Modal Popup for Looking for a Driver */}
      <Modal visible={isModalDriverVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.fetchinDriverModal}>
            <Text style={styles.DeliveryInfoTitle}>Looking for a driver</Text>
            <ActivityIndicator style={styles.ActivityIndicatorModal} size="large" color="#FFD21F" />
          </View>
        </View>
      </Modal>
      <Modal visible={isModalNoteRestaurantVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior='padding'>
        <View style={styles.noteRestaurantModal}>
        <Text style={styles.noteModalTitle}>Note for the restaurant</Text>
        <TextInput
          style={styles.noteInput}
          placeholder='ex: Sandwich sans ketchup' 
          value={noteRestaurant} 
          onChangeText={setNoteRestaurant} 
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity 
            style={styles.cancelBtn}
            onPress={() => {
              setNoteRestaurant(''); // Reset note
              setModalNoteRestaurantVisible(false); // Close modal
            }}
          >
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn}
            onPress={() => {
              setModalNoteRestaurantVisible(false); // Close modal
            }}
          >
            <Text style={styles.saveBtnTxt}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={isModalNoteDriverVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior='padding'>
        <View style={styles.noteRestaurantModal}>
        <Text style={styles.noteModalTitle}>Note for the Driver</Text>
        <TextInput
          style={styles.noteInput}
          placeholder='ex: laissez moi un sms quand vous arrivée' 
          value={noteDriver} 
          onChangeText={setNoteDriver} 
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.cancelBtn}
            onPress={() => {
              setNoteDriver(''); // Reset note
              setModalNoteDriverVisible(false); // Close modal
            }}
          >
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn}
            onPress={() => {
              setModalNoteDriverVisible(false); // Close modal
            }}
          >
            <Text style={styles.saveBtnTxt}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
        </View>
      </Modal>      
    </SafeAreaView>
  );
};

export default OrderDetailsClient;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    paddingHorizontal: 15,
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
  confirmBtnContainer: {
    alignItems: 'center',
  },
  confirmOrderBtn: {
    width: Dimensions.get('window').width * 0.93,
    height: Dimensions.get('window').width * 0.11,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    borderRadius: 25,
    backgroundColor: '#FEC631',
    ...(Platform.OS === 'ios' && {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 5,
      marginBottom: 10
    }),
  },
  confirmBtnTxt: {
    fontWeight: '500',
    color: '#FFF',
    fontSize: 17
  },
  MapContainer: {
    width: Dimensions.get('window').width * 0.93,
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
  markerImage: {
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
  modalOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1
  },
  noteRestaurantModal: {
    width: Dimensions.get('window').width * 0.93,
    height: Dimensions.get('window').width * 0.45,
    padding: 20,
    marginHorizontal: 13,
    marginVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    backgroundColor: 'white',
     ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC631',
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 100,
    }),
  },
  noteModalTitle: {
    fontSize: 20,
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 30,
    padding: 10,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButtons: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%'
  },
  cancelBtn: {
    backgroundColor: '#FFF',
    borderColor: '#FEC631',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: Dimensions.get('window').width * 0.20,
    height: Dimensions.get('window').width * 0.10,
    borderRadius: 30,
  },
  cancelBtnTxt: {
    color: '#FEC631',
  },
  saveBtn: {
    backgroundColor: '#FEC631',
    alignItems: 'center',
    justifyContent: 'center',
    width: Dimensions.get('window').width * 0.20,
    height: Dimensions.get('window').width * 0.10,
    borderRadius: 30,
  },
  saveBtnTxt: {
    color: '#FFF'
  },  
  fetchinDriverModal: {
    width: Dimensions.get('window').width * 0.93,
    height: Dimensions.get('window').width * 0.45,
    padding: 20,
    marginHorizontal: 13,
    marginVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    backgroundColor: 'white',
     ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC631',
      shadowOpacity: 0.8,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 100,
    }),
  },
  ActivityIndicatorModal: {
    marginTop: 40
  },
  DeliveryInfo: {
    width: Dimensions.get('window').width * 0.93,
    height: Dimensions.get('window').width * 0.45,
    padding: 20,
    marginHorizontal: 13,
    marginVertical: 10,
    borderRadius: 25,
    backgroundColor: 'white',
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
  DeliveryInfoTitle: {
    fontSize: 20,
    fontWeight: '500',
  },
  NameParentContainer: {
    flexDirection: 'row',
    paddingLeft: 10,
    paddingTop: 13,
  },
  NameLogo: {
    marginRight: 10,
    marginTop: 4,
  },
  NameTxt: {
    fontWeight: '500'
  },
  nameContent: {
    color: 'grey'
  },
  PhoneParentContainer: {
    flexDirection: 'row',
    paddingLeft: 10,
    paddingTop: 10,
  },
  PhoneLogo: {
    marginRight: 10,
    marginTop: 4,
  },
  PhoneTxt: {
    fontWeight: '500'
  },
  phoneContent: {
    color: 'grey',
    paddingLeft: 5
  },
  OrderInfo: {
    width: Dimensions.get('window').width * 0.93,
    padding: 20,
    marginHorizontal: 13,
    marginVertical: 10,
    borderRadius: 25,
    backgroundColor: 'white',
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
  orderInfoTitle: {
    marginBottom: 6,
    fontSize: 20,
    fontWeight: '500',
  },
  Item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
  },
  ItemCount: {
    color: '#FEC631',
    fontWeight: 'bold',
    fontSize: 17
  },
  ItemName: {
    fontWeight: '400',
    fontSize: 16
  },
  ItemPrice: {
    color: '#FEC631',
    fontWeight: 'bold',
    fontSize: 17
  },
  NoteBtnImg: {
    marginTop: 5
  },
  ResturantBtnNote: {
    flexDirection: 'row',
    marginTop: 15,
  },
  ResturantNoteBtnTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 7,
  },
  ResturantNoteBtnDescreption: {
    color: 'grey',
    marginLeft: 15
  },
  paymentInfo: {
    width: Dimensions.get('window').width * 0.93,
    padding: 20,
    marginHorizontal: 13,
    marginVertical: 10,
    borderRadius: 25,
    backgroundColor: 'white',
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
  paymentInfoTitle: {
    marginBottom: 6,
    fontSize: 20,
    fontWeight: '500',
  },
  paymentLine: {
    flexDirection: 'row',
    padding: 5,
    justifyContent: 'space-between'
  },
  orderPriceTitle: {
    fontSize: 17,
    fontWeight: '500'
  },
  orderPrice: {
    color: '#FEC631',
    fontSize: 17,
    fontWeight: '500'
  },
  deliveryFeesTitle: {
    fontSize: 17,
    fontWeight: '500'
  },
  deliveryFeesPrice: {
    color: '#FEC631',
    fontSize: 17,
    fontWeight: '500'
  },
  TotalPriceTitle: {
    fontSize: 17,
    fontWeight: '500'
  },
  TotalPrice: {
    color: '#FEC631',
    fontSize: 17,
    fontWeight: '500'
  },
});
