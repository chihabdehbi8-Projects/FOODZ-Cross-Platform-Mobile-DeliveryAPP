import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Keyboard, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location'; // Ensure expo-location is installed
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
    const [userName, setUserName] = useState('');
    const [isSearching, setIsSearching] = useState(false); 
    const [searchText, setSearchText] = useState(''); 
    const [wilaya, setWilaya] = useState(''); 
    const [loading, setLoading] = useState(true); 
    const user = auth.currentUser;
    const navigation = useNavigation();
    const [isClicked, setIsClicked] = useState(false);
    const [isClicked1, setIsClicked1] = useState(false);
    const [isClicked2, setIsClicked2] = useState(false);
    const [isClicked3, setIsClicked3] = useState(false);
    const [isClicked4, setIsClicked4] = useState(false);
    const [isClicked5, setIsClicked5] = useState(false);
    
    const handleUserIconPress = () => {
      setIsNewContentVisible(!isNewContentVisible);
    };
    const handlePress = () => {
      setIsClicked(!isClicked);
    }
    const handlePress1 = () => {
      setIsClicked1(!isClicked1);
    }
    const handlePress2 = () => {
      setIsClicked2(!isClicked2);
    }
    const handlePress3 = () => {
      setIsClicked3(!isClicked3);
    }
    const handlePress4 = () => {
      setIsClicked4(!isClicked4);
    }
    const handlePress5 = () => {
      setIsClicked5(!isClicked5);
    }
    // Memoized fetchUserData function to avoid re-creation on every render
    const fetchUserData = useCallback(async () => {
        if (user) {
            try {
                const userRef = collection(db, 'users');
                const q = query(userRef, where("email", "==", user.email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    querySnapshot.forEach(doc => {
                        const userData = doc.data();
                        setUserName(`${userData.name} ${userData.surname}`);
                    });
                }
            } catch (error) {
                console.error('Error fetching user data: ', error);
            }
        }
    }, [user]);

    // Memoized getLocation function to avoid re-creation on every render
    const getLocation = useCallback(async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                setWilaya('Unknown');
                return;
            }

            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Low, // Lower accuracy for faster results
            });

            const { latitude, longitude } = location.coords;

            let geocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (geocode.length > 0) {
                setWilaya(geocode[0].region || geocode[0].subregion || 'Unknown');
            } else {
                setWilaya('Unknown');
            }
        } catch (error) {
            console.error('Error getting location: ', error);
            setWilaya('Unknown');
        }
    }, []);

    // Fetch both user data and location in parallel
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch location and user data in parallel
                const locationPromise = getLocation();
                const userDataPromise = fetchUserData();

                await Promise.all([locationPromise, userDataPromise]);

                setLoading(false); // Stop loading once both tasks are done
            } catch (error) {
                console.error('Error fetching data: ', error);
                setLoading(false); // Stop loading even if an error occurs
            }
        };

        fetchData();
    }, [fetchUserData, getLocation]);

    const handleSearchToggle = useCallback(() => {
        setIsSearching(true); // Enter search mode
    }, []);

    const handleSearchInputBlur = useCallback(() => {
        setIsSearching(false); // Exit search mode when input loses focus
        Keyboard.dismiss(); // Close the keyboard
    }, []);

    if (loading) {
        // Render a loading screen while fetching location and user data
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FEC635" />
                <Text style={styles.loadingText}>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.SearchBarContainer}>
                <TouchableOpacity style={styles.roundButton} onPress={handleSearchToggle}>
                    <Image style={styles.locationIcon}
                           source={require('../assets/search.png')}
                    />
                </TouchableOpacity>
                <View style={styles.searchBar}>
                    {isSearching ? (
                        <TextInput
                            style={styles.searchInput}
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="Search Restaurants"
                            autoFocus={true} 
                            onBlur={handleSearchInputBlur} 
                        />
                    ) : (
                        <Text style={styles.PlaceHText}>
                            <Text style={styles.boldText}>Restaurants In</Text> {wilaya || 'Unknown'}
                        </Text>
                    )}
                </View>
            </View>

            {/* Content Section */}
            <ScrollView contentContainerStyle={styles.content}>
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
                    <ScrollView horizontal={true} style={styles.Hmenu}>
                      <TouchableOpacity style={[styles.HmenuBTN, { backgroundColor: isClicked ? '#FEC635' : 'white' }, { borderColor: isClicked ? '#FEC635' : 'black' }]} onPress={handlePress}>
                        <Text style={[styles.HmenuBTNtxt, { color: isClicked ? 'white' : 'black' }]}>Fast Food</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.HmenuBTN, { backgroundColor: isClicked1 ? '#FEC635' : 'white' }, { borderColor: isClicked1 ? '#FEC635' : 'black' }]} onPress={handlePress1}>
                        <Text style={[styles.HmenuBTNtxt, { color: isClicked1 ? 'white' : 'black' }]}>Restaurant</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.HmenuBTN,{ backgroundColor: isClicked2 ? '#FEC635' : 'white' }, { borderColor: isClicked2 ? '#FEC635' : 'black' }]} onPress={handlePress2}>
                        <Text style={[styles.HmenuBTNtxt, { color: isClicked2 ? 'white' : 'black' }]}>Pizzeria</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.HmenuBTN, { backgroundColor: isClicked3 ? '#FEC635' : 'white' }, { borderColor: isClicked3 ? '#FEC635' : 'black' }]} onPress={handlePress3}>
                        <Text style={[styles.HmenuBTNtxt, { color: isClicked3 ? 'white' : 'black' }]}>Patisserie</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.HmenuBTN, { backgroundColor: isClicked4 ? '#FEC635' : 'white' }, { borderColor: isClicked4 ? '#FEC635' : 'black' }]} onPress={handlePress4}>
                        <Text style={[styles.HmenuBTNtxt, { color: isClicked4 ? 'white' : 'black' }]}>Créprie</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.HmenuBTN, { backgroundColor: isClicked5 ? '#FEC635' : 'white' }, { borderColor: isClicked5 ? '#FEC635' : 'black' }]} onPress={handlePress5}>
                        <Text style={[styles.HmenuBTNtxt, { color: isClicked5 ? 'white' : 'black' }]}>Cafétéria</Text>
                      </TouchableOpacity>
                    </ScrollView>
                </View>
                {/* Cards Section */}
                <View style={styles.RestaurantCardContainer}>
                  <View style={styles.RestaurantCard}>
                    <View style={styles.CoverPicContainer}>
                      <Image style={styles.RestaurantCoverPic}
                          source={require('../assets/CheckITCover.jpeg')}
                      />
                    </View>
                    <View style={styles.CardInfo}>
                      <View style={styles.RIconContainer}>
                        <Image style={styles.IconCard}
                               source={require('../assets/CheckLogo.jpeg')}
                        />
                      </View>
                      <TouchableOpacity style={styles.RestaurantDescriptionContainer} onPress={() => {/* Navigate to Menu */}}>
                        <Text style={styles.RestaurantName}>Check'IT</Text>
                        <Text style={styles.RestaurantSpeciality}>Pizza - Sandwish</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <View style={styles.RestaurantCardContainer}>
                  <View style={styles.RestaurantCard}>
                    <View style={styles.CoverPicContainer}>
                      <Image style={styles.RestaurantCoverPic}
                          source={require('../assets/notre-salon.jpg')}
                      />
                    </View>
                    <View style={styles.CardInfo}>
                      <View style={styles.RIconContainer}>
                        <Image style={styles.IconCard}
                               source={require('../assets/PLogo.jpg')}
                        />
                      </View>
                      <TouchableOpacity style={styles.RestaurantDescriptionContainer} onPress={() => {/* Navigate to Menu */}}>
                        <Text style={styles.RestaurantName}>Paradise</Text>
                        <Text style={styles.RestaurantSpeciality}>Dishes - Fish - Pizza</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
            </ScrollView>

            {/* Horizontal Button Menu */}
            <View style={styles.menuContainer}>
                <View style={styles.menu}>
                    <TouchableOpacity style={styles.menuButton} onPress={() => {/* Navigate to Screen 1 */}}>
                        <Image
                          style={styles.Icon}
                          source={require('../assets/home.png')}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuButton} onPress={() => {/* Navigate to Screen 2 */}}>
                        <Image
                          style={styles.Icon}
                          source={require('../assets/favorites.png')}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuButton} onPress={() => {/* Navigate to Screen 3 */}}>
                        <Image
                          style={styles.Icon1}
                          source={require('../assets/menu.png')}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuButton} onPress={() => {/* Navigate to Screen 3 */}}>
                        <Image
                          style={styles.Icon}
                          source={require('../assets/user.png')}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white'
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
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
    },
    HederIcon: {
        marginLeft: 45,
        transform: [{ rotate: '-25deg' }]
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
    roundButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
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
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
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
      maxHeight: '45%'
    },
    RestaurantCard: {
      backgroundColor: 'white',
      borderRadius: 40,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    },
    CoverPicContainer: {
      maxHeight: '60%',
      maxWidth: '100%',
      overflow: 'hidden',
      borderRadius: 30,
    },
    RestaurantCoverPic: {
      maxHeight: '100%',
      maxWidth: '100%',
    },
    CardInfo: {
      padding: 7,
      flexDirection:'row',
      height: '30%',
    },
    RIconContainer: {
      maxHeight: '100%',
      maxWidth: '20%',
      overflow: 'hidden',
      paddingLeft: 8,
      paddingTop: 10
    },
    IconCard: {
      maxHeight: '100%',
      maxWidth: '100%',
      borderRadius: 100,
    },
    RestaurantDescriptionContainer: {
      padding: 15
    },
    RestaurantName:{
      fontSize: 20,
      fontWeight: 'bold',
    },
    RestaurantSpeciality: {
      color: 'grey',
      fontSize: 15
    },
    menuContainer: {
      padding: 7
    }, 
    menu: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
    },
    menuButton: {
        alignItems: 'center',
    },
});

export default HomeScreen;
