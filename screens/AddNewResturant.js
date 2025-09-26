import React, { useState } from 'react';
import { 
    View, Text, SafeAreaView, StyleSheet, 
    Platform, StatusBar, TouchableOpacity, Image, ScrollView, TextInput, KeyboardAvoidingView, Modal, Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { storage } from '../firebase'; // Adjust the path as necessary
import { doc, setDoc, getFirestore } from "firebase/firestore";
import { Picker } from '@react-native-picker/picker';
import {uploadBytes, getDownloadURL } from "firebase/storage";
import { ref} from 'firebase/storage'; // Firebase Storage
import * as ImagePicker from 'expo-image-picker'; // Expo Image Picker
import { getAuth } from "firebase/auth";
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const AddNewResturant = () => {
    const [restaurantName, setRestaurantName] = useState('');
    const [speciality, setSpeciality] = useState('');
    const [sections, setSections] = useState([
        { sectionName: '', items: [{ itemName: '', ingredients: '', price: '' }] }
    ]);    
    const [coverImage, setCoverImage] = useState(null);
    const [logoImage, setLogoImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);
    const auth = getAuth();
    const user = auth.currentUser;
    const db = getFirestore();
    const navigation = useNavigation();
    const [selectedWilaya, setSelectedWilaya] = useState('Wilaya');  // Default text for Wilaya
    const [isPickerVisible, setPickerVisible] = useState(false);  // Control Picker visibility
    const [selectedCategories, setSelectedCategories] = useState([]); // State for selected categories
    const categories = ['Fast Food', 'Restaurant', 'Pizzeria', 'Patisserie'];
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [location, setLocation] = useState({ latitude: 36.75, longitude: 3.06 });
    
    const wilayaCoordinates = {
        Alger: { latitude: 36.75, longitude: 3.06 },
        Oran: { latitude: 35.69, longitude: -0.64 },
        Tiaret: { latitude: 35.37849000, longitude: 1.32569000 },
        // Add more Wilayas here if needed
    };

    if (user) {
        console.log("User is authenticated:", user.uid);
    } else {
        console.log("No user is authenticated.");
    }

    // Function to remove a section by index
    const removeSection = (sectionIndex) => {
        setSections(sections.filter((_, index) => index !== sectionIndex));
    };

    // Function to remove an item from a specific section
    const removeItem = (sectionIndex, itemIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].items = newSections[sectionIndex].items.filter((_, index) => index !== itemIndex);
        setSections(newSections);
    };

    const saveRestaurantInfo = async () => {
        // Validate inputs
        if (!restaurantName || !speciality || !logoImage || !coverImage || selectedWilaya === 'Wilaya'|| !selectedLocation) {
            Alert.alert("Please fill all fields correctly.");
            return;
        }

        // Check if at least one category is selected
        if (selectedCategories.length === 0) {
            Alert.alert("Please select at least one category.");
            return;
        }

        // Check if there is at least one section with at least one item
        if (sections.length === 0 || !sections.some(section => section.items.length > 0 && section.items[0].itemName)) {
            Alert.alert("Please add at least one section with one item.");
            return;
        }

        const wilayaRef = doc(db, 'Wilayas', selectedWilaya);
        const restaurantId = restaurantName.replace(/\s+/g, '_') + '_' + Date.now();
        const restaurantRef = doc(wilayaRef, 'Restaurants', restaurantId);

        const restaurantData = {
            name: restaurantName,
            speciality: speciality,
            logo: logoImage,
            cover: coverImage,
            location: [selectedLocation.longitude, selectedLocation.latitude],
            categories: selectedCategories,
            wilaya: selectedWilaya,
            menu: {}  // Initialize menu structure
        };

        try {
            // Save restaurant data to Firestore
            await setDoc(restaurantRef, restaurantData);

            // Save each section with its items as a sub-document in the menu
            for (const section of sections) {
                const sectionRef = doc(restaurantRef, 'menu', section.sectionName); // Use section name as ID
                const sectionData = {
                    items: section.items.map(item => ({
                        itemName: item.itemName,
                        ingredients: item.ingredients,
                        price: item.price
                    }))
                };
                await setDoc(sectionRef, sectionData);
            }

            Alert.alert("Restaurant saved successfully!");
            navigation.navigate('AdminHome', { shouldFetchRestaurants: true });
        } catch (error) {
            console.error("Error saving restaurant: ", error);
            Alert.alert("Error saving restaurant: ", error.message);
        }
    };

    // Function to handle category selection
    const toggleCategory = (category) => {
        setSelectedCategories((prev) => {
            if (prev.includes(category)) {
                return prev.filter(cat => cat !== category);
            } else {
                return [...prev, category];
            }
        });
    };

    // Function to add a new section
    const addSection = () => {
        setSections([...sections, { sectionName: '', items: [{ itemName: '', ingredients: '', price: '' }] }]);
    };

    // Function to update section name
    const updateSectionName = (index, name) => {
        const newSections = [...sections];
        newSections[index].sectionName = name;
        setSections(newSections);
    };

    // Function to add a new item to a specific section
    const addItem = (sectionIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].items.push({ itemName: '', ingredients: '', price: '' });
        setSections(newSections);
    };

    // Function to update item details
    const updateItem = (sectionIndex, itemIndex, field, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].items[itemIndex][field] = value;
        setSections(newSections);
    };


    const pickLogoImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            alert('Permission to access media library is required!');
            return;
        }
    
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Logos are often square
            quality: 1,
        });
    
        if (!result.canceled) {
            const selectedImageUri = result.assets[0].uri;
            uploadLogoImage(selectedImageUri);
        }
    };
    
    const uploadLogoImage = async (uri) => {
        setIsLogoUploading(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const imageRef = ref(storage, `restaurants/logo_images/${auth.currentUser.uid}_${Date.now()}`);
            const snapshot = await uploadBytes(imageRef, blob);
            const downloadURL = await getDownloadURL(snapshot.ref);
            console.log('Logo Image URL:', downloadURL); // Add this to log the URL
            setLogoImage(downloadURL); // Update the logo image state
        } catch (error) {
            console.error('Error uploading logo image: ', error);
        } finally {
            setIsLogoUploading(false);
        }
    };
    
    /// Function to handle image selection
 const pickImage = async () => {
    // Request permission to access media library
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
        alert('Permission to access media library is required!');
        return;
    }
    // Launch the image picker
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
    });

    if (!result.canceled) {
        const selectedImageUri = result.assets[0].uri;
        uploadImage(selectedImageUri);
    }
};

// Function to upload the image to Firebase Storage
const uploadImage = async (uri) => {
    setIsUploading(true); // Set uploading to true
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageRef = ref(storage, `restaurants/cover_images/${auth.currentUser.uid}_${Date.now()}`);
        const snapshot = await uploadBytes(imageRef, blob);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // This should update your cover image state with the download URL
        setCoverImage(downloadURL); // Update the cover image state
    } catch (error) {
        console.error('Error uploading image: ', error);
    } finally {
        setIsUploading(false); // Set uploading to false after completion
    }
};
  
      const handleWilayaPress = () => {
        setPickerVisible(true);  // Show the picker when "Wilaya" is pressed
    };

    const handlePickerChange = (value) => {
        setSelectedWilaya(value);  // Set the selected Wilaya
        setPickerVisible(false);  // Hide the picker after selection
    };

   const openMap = () => {
        if (selectedWilaya === 'Wilaya') {
            Alert.alert('Please select a Wilaya first.');
            return;
        }
        const { latitude, longitude } = wilayaCoordinates[selectedWilaya];
        setLocation({ latitude, longitude }); // Center map on selected Wilaya
        setIsMapVisible(true);
    };

    const saveLocation = () => {
        if (selectedLocation) {
            setIsMapVisible(false);
        } else {
            Alert.alert('Please select a location on the map.');
        }
    };

    const handleRegionChange = (region) => setLocation(region);
    const handleMapPress = (e) => setSelectedLocation(e.nativeEvent.coordinate); // Set marker location


  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.SearchBarContainer}>
        <TouchableOpacity style={styles.roundButton} onPress={() => navigation.navigate('AdminHome')}>
            <Image style={styles.Back} source={require('../assets/close.png')} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
            <Text style={styles.PlaceHText}>
                <Text style={styles.boldText}>New restaurant</Text>
            </Text>
        </View>
        <TouchableOpacity onPress={saveRestaurantInfo} style={styles.roundButton}>
            <Image style={styles.SaveBtn} source={require('../assets/tick.png')} />
        </TouchableOpacity>
    </View>
    
    {/* KeyboardAvoidingView wrapping ScrollView */}
    <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
    >
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
        >
            <View style={styles.RestaurantCardContainer}>
                <View style={styles.RestaurantCard}>
                <TouchableOpacity 
                                style={styles.CoverPicContainer} 
                                onPress={pickImage}
                            >
                                {/* Show selected or default image */}
                                {isUploading ? (
                                    <ActivityIndicator style={styles.loadingLogo} size="large" color="#fec635" /> // Show ActivityIndicator while uploading
                                ) : (
                                    <Image
                                        source={coverImage ? { uri: coverImage } : require('../assets/default-cover.jpg')}
                                        style={styles.RestaurantCoverPic}
                                        resizeMode= "cover" // Use "cover" to maintain aspect ratio and fill the container
                                    />
                                )}
                            </TouchableOpacity>
                    <View style={styles.CardInfo}>
                        <TouchableOpacity style={styles.RIconContainer}
                                            onPress={pickLogoImage}>
                                            {isLogoUploading ? (
                                                <ActivityIndicator size="large" color="#fec635" /> // Show ActivityIndicator while uploading
                                            ) : (
                                                <Image 
                                                    style={styles.IconCard} 
                                                    source={logoImage ? { uri: logoImage } : require('../assets/logo-design.png')} 
                                                    resizeMode= "cover" 
                                                />
                                            )}
                        </TouchableOpacity>
                        <View style={styles.RestaurantDescriptionContainer}>
                            <TextInput
                                style={styles.hiddenInputName}
                                value={restaurantName}
                                onChangeText={setRestaurantName}
                                placeholder="Name of resturant"
                            />
                            <TextInput
                                style={styles.hiddenInput}
                                value={speciality}
                                onChangeText={setSpeciality}
                                placeholder="Speciality of resturant"
                            />
                            <Text style={styles.RestaurantName}>{restaurantName || 'Name'}</Text>
                            <Text style={styles.RestaurantSpeciality}>{speciality || 'Speciality'}</Text>
                        </View>
                        <View style={styles.WLBtnsContainer}>
                            <TouchableOpacity onPress={handleWilayaPress} style={styles.wilayaBtn}>
                                <Text style={styles.WilayaTxT}>{selectedWilaya}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.locationBtn} onPress={openMap}>
                                <Text style={styles.locationBtnTXT}>Location</Text>
                            </TouchableOpacity>
                        </View>
                        {/* Map Modal */}
                        <Modal visible={isMapVisible} animationType="slide" transparent={true}>
                            <View style={styles.modalContainer}>
                                <MapView
                                    style={styles.map}
                                    provider={PROVIDER_GOOGLE}
                                    region={{
                                        ...location,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    }}
                                    onPress={handleMapPress}
                                >
                                    {selectedLocation && (
                                        <Marker coordinate={selectedLocation} />
                                    )}
                                </MapView>
                                <View style={styles.mapButtons}>
                                    <TouchableOpacity onPress={saveLocation} style={styles.saveBtn}>
                                        <Text>Save</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsMapVisible(false)} style={styles.cancelBtn}>
                                        <Text>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </View>
                    <View style={styles.HmenuContainer}>
                                <ScrollView showsHorizontalScrollIndicator={false} horizontal={true} style={styles.Hmenu}>
                                    {categories.map((category, index) => (
                                        <TouchableOpacity 
                                            key={index} 
                                            style={[
                                                styles.HmenuBTN, 
                                                { 
                                                    backgroundColor: selectedCategories.includes(category) ? '#FEC635' : 'white' 
                                                }, 
                                                { borderColor: selectedCategories.includes(category) ? '#FEC635' : 'black' }
                                            ]} 
                                            onPress={() => toggleCategory(category)}
                                        >
                                            <Text style={[styles.HmenuBTNtxt, { color: selectedCategories.includes(category) ? 'white' : 'black' }]}>
                                                {category}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                    {/* Menu Section with Text Inputs */}
                            <View style={styles.MenuContainer}>
                             <View style={styles.MenuNdBtn}>
                                 <Text style={styles.MenuTitle}>Menu</Text>
                                 <TouchableOpacity style={styles.addSectionBtn} onPress={addSection}>
                                     <Image style={styles.locationIcon} source={require('../assets/plus-5.png')} />
                                 </TouchableOpacity>
                             </View>

                             {sections.map((section, sectionIndex) => (
                                 <View key={sectionIndex} style={styles.SectionContainer}>
                                     <View style={styles.sectionNdBtn}>  
                                         <TextInput
                                             style={styles.hiddenInputSection}
                                             value={section.sectionName}
                                             onChangeText={(text) => {
                                                 const newSections = [...sections];
                                                 newSections[sectionIndex].sectionName = text;
                                                 setSections(newSections);
                                             }}
                                             placeholder="Section Name of the resturant"
                                         />
                                         <Text style={styles.SectionName}>{section.sectionName || 'Section'}</Text>
                                         <View style={styles.SectionBtns}>
                                             <TouchableOpacity style={styles.addItemBtn} onPress={() => addItem(sectionIndex)}>
                                                 <Image style={styles.locationIcon} source={require('../assets/plus-5.png')} />
                                             </TouchableOpacity>
                                             <TouchableOpacity style={styles.addItemBtn} onPress={() => removeSection(sectionIndex)}>
                                                 <Image style={styles.locationIcon} source={require('../assets/minus.png')} />
                                             </TouchableOpacity>
                                         </View>
                                     </View>

                                     {/* Items for this section */}
                                     {section.items.map((item, itemIndex) => (
                                         <View key={itemIndex} style={styles.ItemContainer}>
                                             <TextInput
                                                 style={styles.hiddenInputItemName}
                                                 value={item.itemName}
                                                 onChangeText={(text) => {
                                                     const newSections = [...sections];
                                                     newSections[sectionIndex].items[itemIndex].itemName = text;
                                                     setSections(newSections);
                                                 }}
                                                 placeholder="Item Name of the resturant"
                                             />
                                             <TextInput
                                                 style={styles.hiddenInputIngredients}
                                                 value={item.ingredients}
                                                 onChangeText={(text) => {
                                                     const newSections = [...sections];
                                                     newSections[sectionIndex].items[itemIndex].ingredients = text;
                                                     setSections(newSections);
                                                 }}
                                                 placeholder="Ingredients of the Item"
                                             />
                                             <TextInput
                                                 style={styles.hiddenInputPrice}
                                                 value={item.price}
                                                 onChangeText={(text) => {
                                                     const newSections = [...sections];
                                                     newSections[sectionIndex].items[itemIndex].price = text;
                                                     setSections(newSections);
                                                  }}
                                                 placeholder="Price of the item"
                                             />
                                             <View style={styles.ItemBtns}>
                                                 <Text style={styles.ItemName}>{item.itemName || 'Item Name'}</Text>
                                                 <TouchableOpacity style={styles.addItemBtn} onPress={() => removeItem(sectionIndex, itemIndex)}>
                                                     <Image style={styles.locationIcon} source={require('../assets/minus.png')} />
                                                 </TouchableOpacity>
                                             </View>
                                             <Text style={styles.Ingredients}>{item.ingredients || 'Ingredients'}</Text>
                                             <Text style={styles.ItemPrice}>{item.price || 'Price'} DA</Text>
                                         </View>
                                     ))}
                                 </View>
                             ))}
                            </View>
                </View>
            </View>
        </ScrollView>
    </KeyboardAvoidingView>
     {/* Modal for Picker */}
     {isPickerVisible && (
                <Modal
                    transparent={true}
                    animationType="slide"
                    visible={isPickerVisible}
                    onRequestClose={() => setPickerVisible(false)}
                >
                    <View style={styles.pickerContainer}>
                        <View style={styles.pickerInnerContainer}>
                            <Picker
                                selectedValue={selectedWilaya}
                                onValueChange={handlePickerChange}
                            >
                                <Picker.Item label="Wilaya" value="Wilaya" />
                                <Picker.Item label="Tiaret" value="Tiaret" />
                                <Picker.Item label="Chlef" value="Chlef" />
                                <Picker.Item label="Alger" value="Alger" />
                                <Picker.Item label="Oran" value="Oran" />
                                <Picker.Item label="Tlemcen" value="Tlemcen" />
                            </Picker>
                        </View>
                    </View>
                </Modal>
            )}
</SafeAreaView>
  )
}

export default AddNewResturant;

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
        flexDirection: 'row',
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
    pickerContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    pickerInnerContainer: {
        backgroundColor: 'white',
        marginHorizontal: 20,
        borderRadius: 10,
        padding: 20,
    },
    RestaurantCardContainer: {
        padding: 7,
    },
    RestaurantCard: {
        backgroundColor: 'white',
        marginBottom: 9,
        borderRadius: 40,
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
    CoverPicContainer: {
        height: 180,
        maxWidth: '100%',
        overflow: 'hidden',
        borderTopRightRadius: 30,
        borderTopLeftRadius: 30,
        justifyContent: 'center', // Center content vertically
        alignItems: 'center', // Center content horizontally
    },
    RestaurantCoverPic: {
        height: '100%', // Fill the container height
        width: '100%', // Fill the container width
    },
    CardInfo: {
        padding: 7,
        flexDirection:'row',
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
        padding: 15,
        width: 230
    },
    hiddenInputName: {
        position: 'absolute',
        left: 5,
        top: 13,
        width: '100%',
        height: '100%',
        opacity: 0, // Hides the input
        paddingHorizontal: 10,
        // Optional styling for better touch experience
        zIndex: 1, // Ensures the input is above the placeholder text
    },
    hiddenInput: {
        position: 'absolute',
        left: 5,
        top: 40,
        width: '100%',
        height: '100%',
        opacity: 0, // Hides the input
        paddingHorizontal: 10,
        // Optional styling for better touch experience
        zIndex: 1, // Ensures the input is above the placeholder text
    },
    RestaurantName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    RestaurantSpeciality: {
        color: 'grey',
        fontSize: 15,
    },
    WLBtnsContainer: {
        ...(Platform.OS === 'android' && {
            width: 140,
            marginLeft: -45
        })
    },
    wilayaBtn: {
        height: 40,
        padding: 10,
        marginRight: 50,
        borderRadius: 25,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        ...(Platform.OS === 'ios' && {
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 5,
          marginRight: 50,
        }),
        ...(Platform.OS === 'android' && {
          elevation: 5,
        }),
    },
    WilayaTxT: {
        fontSize: 15,
        fontWeight: '500',
    },
    Hmenu: {
        flexDirection: 'row',
        marginRight: 3,
      },
      HmenuBTN: {
        backgroundColor: 'white',
        marginLeft: 6,
        marginBottom: 10,
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
      MenuContainer: {
        padding: 15,
        marginBottom: 5
      },
      MenuNdBtn: {
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
      addSectionBtn: {
        width: 30,
        height: 30,
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
      SectionBtns: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: 80
      },
      ItemBtns: {
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
      MenuTitle: {
        fontSize: 30,
        fontWeight: 'bold',
      },
      SectionContainer: {
        paddingTop: 15
      },
      SectionName: {
        fontSize: 23,
        fontWeight: 'bold',
        marginLeft: 10,
      },
      sectionNdBtn: {
        flexDirection: 'row',
        justifyContent: 'space-between'
      },
      hiddenInputSection: {
        position: 'absolute',
        left: 5,
        top: 20,
        opacity: 0, // Hides the input
        paddingHorizontal: 10,
        // Optional styling for better touch experience
        zIndex: 1, // Ensures the input is above the placeholder text
    },
      ItemContainer: {
        marginLeft: 11,
        paddingTop: 10,
        borderBottomWidth: 2,
        borderColor: '#D3D3D3',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
      },
      addItemBtn: {
        width: 30,
        height: 30,
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
      ItemName: {
        fontSize: 20
      },
      hiddenInputItemName: {
        position: 'absolute',
        left: 5,
        top: 17,
        opacity: 0, // Hides the input
        paddingHorizontal: 10,
        // Optional styling for better touch experience
        zIndex: 1, // Ensures the input is above the placeholder text
    },
      Ingredients: {
        paddingTop: 20,
        color: 'grey',
        fontSize: 15,
      },
      hiddenInputIngredients: {
        position: 'absolute',
        left: -3,
        top: 57,
        opacity: 0, // Hides the input
        paddingHorizontal: 10,
        // Optional styling for better touch experience
        zIndex: 1, // Ensures the input is above the placeholder text
    },
    hiddenInputPrice: {
        position: 'absolute',
        left: 0,
        top: 100,
        opacity: 0, // Hides the input
        paddingHorizontal: 10,
        // Optional styling for better touch experience
        zIndex: 1, // Ensures the input is above the placeholder text
    },
      ItemPrice: {
        paddingTop: 20,
        fontSize: 20,
        color: '#FEC635',
        fontWeight: 'bold',
        paddingBottom: 10,
      },
      locationBtn: {
        height: 40,
        padding: 10,
        marginTop: 20,
        marginRight: 50,
        marginBottom: 10,
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
      locationBtnTXT: {
        fontSize: 15,
        fontWeight: '500',
      },
      modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.7 },
    mapButtons: { flexDirection: 'row', marginTop: 10 },
    saveBtn: { flex: 1, padding: 10, backgroundColor: '#ffd21f', margin: 5, borderRadius: 5 },
    cancelBtn: { flex: 1, padding: 10, backgroundColor: '#ddd', margin: 5, borderRadius: 5 },
});
