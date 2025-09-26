import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    View, Text, SafeAreaView, StyleSheet, ScrollView, 
    TouchableOpacity, Image, TextInput, Keyboard, 
    ActivityIndicator, StatusBar, Platform, Alert,Modal, TouchableWithoutFeedback, Linking, KeyboardAvoidingView
} from 'react-native';
import * as Location from 'expo-location'; // Ensure expo-location is installed
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, query, where, getDoc } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '../UserContext';
import { Dimensions} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { usePushNotifications } from '../usePushNotifications';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import axios from 'axios';

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
const DriverActiverOrder = ({ route }) => {
    const navigation = useNavigation();
    const { orderId } = route.params;
    const [orderData, setOrderData] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [restaurantData, setRestaurantData] = useState(null);
    const [isModalOrderListVisible, setModalOrderListVisible] = useState(false);
    const [isModalCancelOrderVisible, setIsModalCancelOrderVisible] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [routeCoordinates, setRouteCoordinates] = useState([]);
    const [watcher, setWatcher] = useState(null);
    const [cancelReason, setCancelReason] = useState();
    const [clientId, setClientId] = useState();
    const [thisOrderDebt, setThisOrderDebt] = useState();
    const [orderStatus, setOrderStatus] = useState('Picked up');
    const MAX_DISTANCE_THRESHOLD = 50; // meters
    const mapRef = useRef(null);
    const lastRegion = useRef({ latitudeDelta: 0.05, longitudeDelta: 0.05 });
    const { sendPushNotification } = usePushNotifications();

    const handlePhoneCall = (phoneNumber) => {
      const phoneUrl = `tel:${phoneNumber}`;
    
      // Check if the platform is Android
      if (Platform.OS === 'android') {
        Linking.openURL(phoneUrl);
      } else {
        // For iOS and other platforms, check if calling is supported
        Linking.canOpenURL(phoneUrl)
          .then((supported) => {
            if (supported) {
              Linking.openURL(phoneUrl);
            } else {
              Alert.alert('Error', 'Phone call not supported on this device');
            }
          })
          .catch((err) => {
            Alert.alert('Error', 'Something went wrong, please try again');
          });
      }
    };
  
    const handleCancelOrder = async () => {
      if (!cancelReason || cancelReason.trim() === '') {
        Alert.alert('Please select or write a reason to cancel the order');
      } else {
        try {
          const orderDocRef = doc(db, 'orders', orderId);
          await sendPushNotification(
            clientId,
            "Order canceled",
            "Your order has been canceled by the driver",
          );
          await updateDoc(orderDocRef, {
            status: 'Canceled',
            canceledBy: 'Driver',
            cancelReason: cancelReason
          });
          setIsModalCancelOrderVisible(false);
          navigation.navigate('DriverHome', { shouldRefetchOrders: true });
          Alert.alert('Order has been canceled successfully.');
        } catch (error) {
          console.error("Error updating order status:", error);
          Alert.alert('Failed to cancel the order. Please try again.');
        }
      }
    };
    

    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const orderDocRef = doc(db, 'orders', orderId);
                const orderDoc = await getDoc(orderDocRef);
                if (orderDoc.exists()) {
                    const data = orderDoc.data();
                    setOrderData(data);
                    if (data.orderStatus === 'Accepted'){
                      setOrderStatus('Picked up');
                    } 
                    if (data.orderStatus === 'Picked up'){
                      setOrderStatus('Delivered');
                    }
                    // Fetch client data
                    const clientDocRef = doc(db, 'users', data.clientId);
                    const clientDoc = await getDoc(clientDocRef);
                    if (clientDoc.exists()) {
                        setClientData(clientDoc.data());
                        setClientId(clientDoc.id);
                    }

                    // Fetch restaurant data
                    const restaurantDocRef = doc(db, 'Wilayas', data.wilaya, 'Restaurants', data.restaurantId);
                    const restaurantDoc = await getDoc(restaurantDocRef);
                    if (restaurantDoc.exists()) {
                        setRestaurantData(restaurantDoc.data());
                    }

                    const deliveryFee = data.deliveryFees;
                    const thisOrderDebt = deliveryFee * 0.3;
                    setThisOrderDebt(thisOrderDebt);
                    console.log('this order debt:', thisOrderDebt);
                } else {
                    console.log('No such document!');
                }
            } catch (error) {
                console.error('Error fetching order data:', error);
            }
        };

        fetchOrderData();
    }, [orderId]);

    const handleRegionChangeComplete = (region) => {
      lastRegion.current = {
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
      };
  };

    // Fetch user's exact location and set initial route
    useEffect(() => {
        const startLocationTracking = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert('Location permission is required');
                return;
            }
            const locationWatcher = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Highest,
                    timeInterval: 2000, /// 2 seconds delay
                    distanceInterval: 10,/// 10 meters delay
                },
                (location) => {
                    const { latitude, longitude } = location.coords;
                    setUserLocation({ latitude, longitude });

                    // Center map on updated location without resetting zoom
                    if (mapRef.current) {
                        mapRef.current.animateToRegion({
                            latitude,
                            longitude,
                            latitudeDelta: lastRegion.current.latitudeDelta,
                            longitudeDelta: lastRegion.current.longitudeDelta,
                        }, 1000);
                    }
                }
            );
            setWatcher(locationWatcher);
        };

        startLocationTracking();

        return () => {
            if (watcher) watcher.remove();
        };
    }, []);

    const fetchRoute = async () => {
      if (!userLocation || !orderData) return;

      try {
          const destination = orderData.orderStatus === "Delivered"
              ? { latitude: orderData.clientLocation.latitude, longitude: orderData.clientLocation.longitude }
              : { latitude: restaurantData.location[1], longitude: restaurantData.location[0] };

          const response = await axios.get(
              `https://api.openrouteservice.org/v2/directions/driving-car`, 
              {
                  params: {
                      api_key: '5b3ce3597851110001cf62480d8a3d89ca5f4cb0aefdb95240e3f61e', // Replace with actual OpenRouteService API key
                      start: `${userLocation.longitude},${userLocation.latitude}`,
                      end: `${destination.longitude},${destination.latitude}`
                  }
              }
          );

          const coordinates = response.data.features[0].geometry.coordinates;
          const decodedCoordinates = coordinates.map(coord => ({
              latitude: coord[1],
              longitude: coord[0]
          }));
          setRouteCoordinates(decodedCoordinates);
      } catch (error) {
          console.error("Error fetching route from OpenRouteService:", error);
      }
  };
    // Fetch route from user to restaurant when userLocation and restaurantData are available
    useEffect(() => {
      const fetchRoute = async () => {
          if (!userLocation || !orderData) return;

          try {
              const destination = orderData.orderStatus === "Picked up"
                  ? { latitude: orderData.clientLocation.latitude, longitude: orderData.clientLocation.longitude }
                  : { latitude: restaurantData.location[1], longitude: restaurantData.location[0] };

              const response = await axios.get(
                  `https://api.openrouteservice.org/v2/directions/driving-car`, 
                  {
                      params: {
                          api_key: '5b3ce3597851110001cf62480d8a3d89ca5f4cb0aefdb95240e3f61e', // Replace with actual OpenRouteService API key
                          start: `${userLocation.longitude},${userLocation.latitude}`,
                          end: `${destination.longitude},${destination.latitude}`
                      }
                  }
              );

              const coordinates = response.data.features[0].geometry.coordinates;
              const decodedCoordinates = coordinates.map(coord => ({
                  latitude: coord[1],
                  longitude: coord[0]
              }));
              setRouteCoordinates(decodedCoordinates);
          } catch (error) {
              console.error("Error fetching route from OpenRouteService:", error);
          }
      };

      if (restaurantData || orderData?.orderStatus === "Delivered") {
          fetchRoute();
      }
  }, [userLocation, restaurantData, orderData]);

  const checkDeviationFromRoute = useCallback(() => {
    if (!userLocation || !routeCoordinates.length) return;

    const userPoint = { latitude: userLocation.latitude, longitude: userLocation.longitude };
    const isOutOfRoute = routeCoordinates.every(coord => {
        const distance = haversineDistance(userPoint, coord);
        return distance > MAX_DISTANCE_THRESHOLD;
    });

    if (isOutOfRoute) fetchRoute();
}, [userLocation, routeCoordinates, fetchRoute]);

useEffect(() => {
    checkDeviationFromRoute();
}, [userLocation, checkDeviationFromRoute]);

const haversineDistance = (point1, point2) => {
    const R = 6371e3; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const lat1 = point1.latitude * Math.PI / 180;
    const lat2 = point2.latitude * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};
const shouldShowClientMarker = orderStatus === 'Delivered';
const shouldShowRestaurantMarker = orderStatus === 'Picked up';



const handleOrderPanelBtnClick = async () => {
    if (orderStatus === 'Picked up'){
      if (orderData?.clientLocation) {
          setRouteCoordinates([userLocation, orderData.clientLocation]);
      }
      setOrderStatus('Delivered');
      const orderDocRef = doc(db, 'orders', orderId);
          await updateDoc(orderDocRef, { orderStatus: 'Picked Up' });
          await sendPushNotification(
            clientId,
            "Order picked up",
            "Your order has been picked up and it's on the way stay hungry :)",
          );
      }
    else if (orderStatus === 'Delivered'){
      const orderDocRef = doc(db, 'orders', orderId);
      await updateDoc(orderDocRef, { status: 'Delivered' });
      await sendPushNotification(
        clientId,
        "Order delivered",
        "Enjoy your meal :)",
      );
      // Fetch the current debt of the driver (current user)
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      const currentDebt = userDoc.data().debt || 0;
      const newDebt = Number(currentDebt) + Number(thisOrderDebt);
      // Update the debt field in the user's document
      await updateDoc(userDocRef, { debt: newDebt });
      navigation.navigate('DriverHome', { shouldRefetchOrders: true });
      Alert.alert('Order has been delivered successfully.');
    };
  };

  return (
    <SafeAreaView style={styles.container}>
        {userLocation ? (
            <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            customMapStyle={greyMapStyle}
            initialRegion={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }}
            onRegionChangeComplete={handleRegionChangeComplete}
        >
            <Marker coordinate={userLocation}>
            <View style={styles.markerContainer}>
                                  <View style={styles.markerDriverBackground}>
                                    <Image
                                     source={require('../assets/vespa.png')}
                                      style={styles.markerDriverImage}
                                     resizeMode="contain"
                                    />
                                  </View>
                                  <View style={styles.pinTriangle} />
                                </View>
            </Marker>
            {shouldShowRestaurantMarker && restaurantData?.location && (
                <Marker coordinate={{
                    latitude: restaurantData.location[1],
                    longitude: restaurantData.location[0]
                }} >
                    <View style={styles.markerContainer}>
                                  <View style={styles.markerBackground}>
                                    <Image
                                     source={{ uri: restaurantData?.logo }}
                                      style={styles.markerImage}
                                     resizeMode="contain"
                                    />
                                  </View>
                                  <View style={styles.pinTriangle} />
                                </View>
                </Marker>
            )}
            {shouldShowClientMarker && (
                        <Marker coordinate={{
                            latitude: orderData?.clientLocation.latitude, 
                            longitude: orderData?.clientLocation.longitude
                        }}>
                            <View style={styles.markerContainer}>
                                  <View style={styles.markerBackground}>
                                    <Image
                                     source={require('../assets/user-11.png')}
                                      style={styles.markerImage}
                                     resizeMode="contain"
                                    />
                                  </View>
                                  <View style={styles.pinTriangle} />
                                </View>
                        </Marker>
                    )}
            {routeCoordinates.length > 0 && (
                <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor="#FEC631" />
            )}
        </MapView>
    ) : (
        <ActivityIndicator size="large" color="#FEC631" />
    )}
            <View style={styles.btnsContainer} pointerEvents="auto">
                <TouchableOpacity style={styles.roundButton} onPress={() => navigation.navigate('DriverHome')}>
                    <Image style={styles.Back} source={require('../assets/back.png')} />
                </TouchableOpacity>  
                <TouchableOpacity style={styles.exitBtn} onPress={() => setIsModalCancelOrderVisible(true)}>
                    <Image style={styles.Back} source={require('../assets/cross.png')} />
                </TouchableOpacity>
            </View>    
        <View style={styles.orderPanel} pointerEvents="auto">
                <View style={styles.orderPanelFirstLine}>
                    <View style={styles.firstLineLeft}>
                        <View style={styles.RIconContainer}>
                          <Image style={styles.IconCard} source={{ uri: restaurantData?.logo }} />
                        </View>
                        <View style={styles.restaurantInfo}>
                          <TouchableOpacity onPress={() => handlePhoneCall(restaurantData?.phoneNumber)}>
                            <Text style={styles.restaurantName}>{restaurantData?.name}</Text>
                            <Text style={styles.restaurantPhoneNumber}>{restaurantData?.phoneNumber}</Text>
                          </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.feesTxt}>{orderData?.deliveryFees} DA</Text>
                </View>
                <View style={styles.orderPanelSecondLine}>
                        <View style={styles.clientPicContainer}>
                          <Image style={styles.IconCard} source={require('../assets/user-11.png')} />
                        </View>
                    <View style={styles.clientInfo}>
                      <TouchableOpacity onPress={() => handlePhoneCall(clientData?.phoneNumber)}>
                        <Text style={styles.clientName}>{clientData?.name}, {clientData?.surname}</Text>
                        <Text style={styles.clientPhoneNumber}>{clientData?.phoneNumber}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.orderListBtn} onPress={() => setModalOrderListVisible(true)}>
                        <Text style={styles.orderListBtnTxt}>Order</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.orderPanelBtn} onPress={handleOrderPanelBtnClick}>
                    <Text style={styles.orderPanelBtnTxt}>{orderStatus}</Text>
                </TouchableOpacity>
            </View>
          
        <Modal visible={isModalOrderListVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setModalOrderListVisible(false)}>
            <View style={styles.modalOrderListOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.orderListModal}>
                    <View style={styles.orderListTitle}>
                        <Text style={styles.orderListTitleTxt}>Order :</Text>
                        <Text style={styles.totalPrice}>{orderData?.totalPrice} DA</Text>
                    </View>
                    <ScrollView style={styles.orderList} showsVerticalScrollIndicator={false}>
                            {orderData?.orderedItems?.map((item, index) => (
                                <View key={index} style={styles.orderContainer}>
                                    <Text style={styles.orderCount}>{item.count}</Text>
                                    <Text style={styles.orderName}>{item.itemName}</Text>
                                    <Text style={styles.orderPrice}>{item.price} DA</Text>
                                </View>
                            ))}
                    </ScrollView>
                    <View style={styles.notesContainer}>
                        <View style={styles.driverNote}>
                            <Text style={styles.driverNoteTitle}>Driver note</Text>
                            <Text style={styles.driverNoteContent}>{orderData?.noteDriver || 'No note for you'}</Text>
                        </View>
                        <View style={styles.restaurantNote}>
                            <Text style={styles.restaurantNoteTitle}>Restaurant note</Text>
                            <Text style={styles.restaurantNoteContent}>{orderData?.noteRestaurant || 'No note for restaurant'}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.orderListModalBtn} onPress={() => setModalOrderListVisible(false)}>
                        <Text style={styles.orderListModalBtnTxt}>Ok</Text>
                    </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>  
        <Modal visible={isModalCancelOrderVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => {setIsModalCancelOrderVisible(false); setCancelReason('');}}>  
            <View style={styles.modalOrderListOverlay}>
              <TouchableWithoutFeedback>
              <KeyboardAvoidingView behavior='padding'>
                <View style={styles.cancelOrderModal}>
                    <View style={styles.orderListTitle}>
                        <Text style={styles.orderListTitleTxt}>Cancel order</Text>
                    </View>
                    <View style={styles.cancelReasons}>
                            <TouchableOpacity style={[
                                  styles.cancelReasonContainer,
                                  cancelReason === 'Client Unreachable' && styles.selectedButton 
                                ]}
                                onPress={() => setCancelReason('Client Unreachable')}>
                              <Text style={[styles.cancelReasonTxt, cancelReason === 'Client Unreachable' && styles.selectedButtonText]}>Client Unreachable</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[
                                  styles.cancelReasonContainer,
                                  cancelReason === 'Personal Emergency' && styles.selectedButton
                                ]}
                                onPress={() => setCancelReason('Personal Emergency')}>
                              <Text style={[styles.cancelReasonTxt, cancelReason === 'Personal Emergency' && styles.selectedButtonText]}>Personal Emergency</Text>
                            </TouchableOpacity>
                    </View>
                    <Text style={styles.otherReaseonsTitle}>Other reasons</Text>
                            <TextInput
                              style={styles.noteInput}
                              placeholder='enter the reason'
                              onChangeText={setCancelReason} 
                            />
                    <TouchableOpacity style={styles.orderListModalBtn} onPress={() => handleCancelOrder()}>
                        <Text style={styles.orderListModalBtnTxt}>Confirm</Text>
                    </TouchableOpacity>
                </View>
                </KeyboardAvoidingView>
              </TouchableWithoutFeedback>                  
            </View>
          </TouchableWithoutFeedback>
        </Modal> 
    </SafeAreaView>
  )
}

export default DriverActiverOrder

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      },
      map: {
        flex: 1,
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
      modalOverlay: {
        justifyContent: 'flex-end',
        alignItems: 'center',
        flex: 1,
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
      btnsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        justifyContent: 'space-between',
        width: Dimensions.get('window').width * 1,
        ...(Platform.OS === 'ios' && {
          marginBottom: 470,
        }),
        ...(Platform.OS === 'android' && {
          marginBottom: 405,
        }),
      },
      exitBtn: {
        backgroundColor: '#FFF',
        borderRadius: 75,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: Dimensions.get('window').width * 0.135,
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
      exitBtnTxt: {
        color: '#FEC631',
        fontWeight: 'bold',
        fontSize: 20,
      },
      orderPanel: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 10,
        marginHorizontal: 20,
        alignItems: 'center',
        width: Dimensions.get('window').width * 0.90,
        height: Dimensions.get('window').width * 0.70,
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
      orderPanelFirstLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: Dimensions.get('window').width * 0.80,
      },
      firstLineLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      RIconContainer: {
        width: Dimensions.get('window').width * 0.14,
        height: Dimensions.get('window').width * 0.14,
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
      restaurantInfo: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 17,
        marginTop: 5,
      },
      restaurantName: {
        fontSize: 13,
        fontWeight: '500',
      },
      restaurantPhoneNumber: {
        fontSize: 13,
        fontWeight: '500',
      },
      feesTxt: {
        color: '#FEC631',
        fontSize: 30,
        fontWeight: 'bold',
      },
      orderPanelSecondLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        width: Dimensions.get('window').width * 0.80,
      },
      clientPicContainer: {
        width: Dimensions.get('window').width * 0.13,
        height: Dimensions.get('window').width * 0.13,
        borderRadius: 50,
        overflow: 'hidden',
        marginTop: 8,
        marginLeft: 4,
        justifyContent: 'center',
        alignItems: 'center',
      },
      clientInfo: {
        justifyContent: 'center',
        marginTop: 10
      },
      clientName: {
        fontSize: 13,
        fontWeight: '500',
      },
      clientPhoneNumber: {
        fontSize: 13,
        marginTop: 5,
        fontWeight: '500',
    },
      orderListBtn: {
        backgroundColor: '#FFF',
        borderRadius: 75,
        borderWidth: 1,
        borderColor: '#FEC631',
        padding: 15,
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
      orderListBtnTxt: {
        color: '#FEC631',
        fontSize: 20,
        fontWeight: '500',
      },
      orderPanelBtn: {
        backgroundColor: '#FEC631',
        borderRadius: 30,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        width: Dimensions.get('window').width * 0.6,
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
      orderPanelBtnTxt: {
        color: '#FFF',
        fontWeight: '500',
        fontSize: 15,
      },
      modalOrderListOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
      },
      orderListModal: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 10,
        alignItems: 'center',
        width: Dimensions.get('window').width * 0.90,
        // iOS shadow styles
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
      orderListTitle: {
        width: Dimensions.get('window').width * 0.90,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      orderListTitleTxt: {
        fontSize: 20,
        fontWeight: '500',
      },
      totalPrice: {
        color: '#FEC631',
        fontWeight: '500',
        fontSize: 20,
        marginLeft: 5,
        marginTop: 3
      },
      orderList: {
        padding: 5,
        marginTop: 10,
        maxHeight: Dimensions.get('window').width * 0.39,
      },
      orderContainer: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginHorizontal: 2,
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
        fontSize: 20,
      },
      orderName: {
        fontWeight: '500',
        fontSize: 15
      },
      orderPrice: {
        color: '#FEC631',
        fontWeight: '500',
        fontSize: 20
      },
      notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: Dimensions.get('window').width * 0.85,
      },
      driverNote: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        width: Dimensions.get('window').width * 0.4,
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
      driverNoteTitle: {
        fontSize: 15,
        fontWeight: '500'
      },
      driverNoteContent: {
        fontSize: 10,
        color: 'grey',
      },
      restaurantNote: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        width: Dimensions.get('window').width * 0.4,
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
      restaurantNoteTitle: {
        fontSize: 15,
        fontWeight: '500'
      },
      restaurantNoteContent: {
        fontSize: 10,
        color: 'grey'
      },
      orderListModalBtn: {
        backgroundColor: '#FEC631',
        borderRadius: 30,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        width: Dimensions.get('window').width * 0.6,
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
      orderListModalBtnTxt: {
        color: '#FFF',
        fontWeight: '500',
        fontSize: 15,
      },
      otherReaseonsTitle: {
        fontSize: 15,
        fontWeight: '500',
        marginTop: 15
      },
      noteInput: {
        backgroundColor: '#F0F0F0',
        borderRadius: 30,
        padding: 10,
        marginTop: 10,
        width: '100%',
        alignItems: 'center',
      },
      selectedButton: {
        backgroundColor: '#FEC631',
      },
      selectedButtonText: {
        color: 'white',
      },
      cancelReasonTxt: {
        fontWeight: '400',
      },
      cancelReasons: {
        flexDirection: 'row'
      },
      cancelReasonContainer: {
        backgroundColor: '#fff',
          borderRadius: 30,
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 10,
          flexDirection: 'row',
          padding: 10,
          marginTop: 15,
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
      cancelOrderModal: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 10,
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
})