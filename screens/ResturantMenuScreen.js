import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  Dimensions,
  ActivityIndicator,Platform, Alert, StatusBar, Modal, TouchableWithoutFeedback
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const RestaurantMenuScreen = ({ route }) => {
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [activeMenu, setActiveMenu] = useState('All');
  const [restaurantInfo, setRestaurantInfo] = useState(null); // Restaurant Info
  const [menuCategories, setMenuCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleItems, setVisibleItems] = useState({}); // State to track visible count container
  const [totalPrice, setTotalPrice] = useState(0); // Total price for the basket
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false); // State to track basket visibility
  const restaurantId = route.params?.restaurantId;
  const wilaya = route.params?.wilaya;
  const [isFavorite, setIsFavorite] = useState(null);
 

  const handleFavoriteToggle = async () => {
    const userId = auth.currentUser.uid; // Get the current user's ID
    const restaurantId = route.params?.restaurantId; // Get the restaurant ID
    const wilaya = route.params?.wilaya; // Get the wilaya
    
    
    if (!userId || !restaurantId || !wilaya) {
      console.error('User ID, Restaurant ID or Wilaya is missing');
      return;
    }

    const favoritesRef = doc(db, `Favorites/${userId}_${restaurantId}`); // Create a unique document reference

    try {
      const favoriteSnap = await getDoc(favoritesRef);
      if (favoriteSnap.exists()) {
        // If it exists, remove from favorites
        await deleteDoc(favoritesRef);
        Alert.alert('Restaurant removed from your favourites');
        setIsFavorite(false);
      } else {
        // If it does not exist, add to favorites
        await setDoc(favoritesRef, {
          userId,
          restaurantId,
          wilaya,
          name: restaurantInfo.name
        });
        Alert.alert('Restaurant added to your favourites');
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorites:', error);
      Alert.alert('Error', 'Something went wrong, please try again');
    }
  };

  useEffect(() => {
    const fetchFavorites = async () => {
      const userId = auth.currentUser.uid; 
      const restaurantId = route.params?.restaurantId; 

      if (!userId || !restaurantId) return;

      const favoritesRef = doc(db, `Favorites/${userId}_${restaurantId}`);
      const favoriteSnap = await getDoc(favoritesRef);

      if (favoriteSnap.exists()) {
        setIsFavorite(true); // Set favorite exists
      } else {
        setIsFavorite(false); // Set favorite does not exist
      }
    };

    fetchFavorites();
  }, [route.params]);

 // Function to calculate total price
const calculateTotalPrice = (categories) => {
  let price = 0;
  categories.forEach((category) => {
    category.items.forEach((item) => {
      if (item.count && item.count > 0) {
        price += item.count * item.price;
      }
    });
  });
  setTotalPrice(price);
};

// Function to toggle item count container visibility
const toggleCountContainer = (categoryId, index) => {
  const uniqueKey = `${categoryId}-${index}`;

  setVisibleItems((prev) => ({
    ...prev,
    [uniqueKey]: !prev[uniqueKey], // Toggle visibility for the selected item
  }));

  // Update the count only if the item is being toggled on for the first time
  const updatedCategories = menuCategories.map((category) => {
    if (category.id === categoryId) {
      return {
        ...category,
        items: category.items.map((item, i) => {
          if (i === index && !item.count) {
            return { ...item, count: 1 }; // Initialize count to 1 if not set
          }
          return item;
        }),
      };
    }
    return category;
  });

  setMenuCategories(updatedCategories);
  calculateTotalPrice(updatedCategories); // Recalculate total price
};

// Function to add an item to the basket and increment count
const addItemToBasket = (categoryId, index) => {
  const updatedCategories = menuCategories.map((category) => {
    if (category.id === categoryId) {
      return {
        ...category,
        items: category.items.map((item, i) =>
          i === index ? { ...item, count: (item.count || 0) + 1 } : item
        ),
      };
    }
    return category;
  });

  setMenuCategories(updatedCategories);
  calculateTotalPrice(updatedCategories); // Recalculate total price
};

// Function to remove an item from the basket and decrement count
const removeItemFromBasket = (categoryId, index) => {
  const updatedCategories = menuCategories.map((category) => {
    if (category.id === categoryId) {
      return {
        ...category,
        items: category.items.map((item, i) => {
          if (i === index) {
            const newCount = Math.max((item.count || 1) - 1, 0);
            return { ...item, count: newCount }; // Decrement count
          }
          return item;
        }),
      };
    }
    return category;
  });

  setMenuCategories(updatedCategories);
  calculateTotalPrice(updatedCategories); // Recalculate total price
};


  const handleScroll = (event) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

  const handlePress = (menu) => {
    setActiveMenu(menu);
  };

  useEffect(() => {
    // Check route params
    console.log(route.params);
  
    // Fetch restaurant and menu data
    const fetchData = async () => {
      const wilaya = route.params?.wilaya; // Pass wilaya from previous screen
      const restaurantId = route.params?.restaurantId;
      setLoading(true);
  
      // Ensure both values are provided
      if (!wilaya || !restaurantId) {
        console.error('Wilaya or Restaurant ID is missing');
        return;
      }
  
      try {
        // Fetch restaurant info
        const restaurantRef = doc(db, `Wilayas/${wilaya}/Restaurants`, restaurantId);
        const restaurantSnap = await getDoc(restaurantRef);
  
        if (restaurantSnap.exists()) {
          setRestaurantInfo(restaurantSnap.data());
  
          // Fetch menu categories
          const menuRef = collection(db, `Wilayas/${wilaya}/Restaurants/${restaurantId}/menu`);
          const menuSnapshot = await getDocs(menuRef);
  
          const categories = [];
          menuSnapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() });
          });
  
          setMenuCategories(categories);
        } else {
          console.error('No such restaurant!');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, [route.params]);
  
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
    <SafeAreaView style={styles.content}>
      <View style={styles.menuPageMenu}>
      {restaurantInfo && (
        <View style={styles.headerContainerMenu}>
          <ImageBackground
            source={{ uri: restaurantInfo.cover }}
            style={styles.coverMenu}
          >
            <View style={styles.SearchBarContainerMenu}>
              <TouchableOpacity
                style={styles.roundButtonMenu}
                onPress={() => navigation.navigate('Home')}
              >
                <Image
                  style={styles.locationIconMenu}
                  source={require('../assets/back.png')}
                />
              </TouchableOpacity>
              <View style={styles.searchBarMenu}></View>
              { isFavorite === true ? (
                <TouchableOpacity
                  style={styles.roundButtonMenuLiked}
                  onPress={handleFavoriteToggle}
                >
                  <Image
                    style={styles.locationIconMenuLiked}
                    source={require('../assets/favorite.png')}
                  />
                </TouchableOpacity>
              ) : (
               <TouchableOpacity
                  style={styles.roundButtonMenu}
                  onPress={handleFavoriteToggle}
               >
                  <Image
                    style={styles.locationIconMenu}
                    source={require('../assets/favorite.png')}
                  />
               </TouchableOpacity>
              )}
                    </View>
                 </ImageBackground>
               </View>
                )}
        {restaurantInfo && (
          <View style={styles.CardInfoMenu}>
            <View style={styles.RIconContainer}>
              <Image
                style={styles.IconCard}
                source={{ uri: restaurantInfo.logo }}
              />
            </View>
            <View style={styles.RestaurantDescriptionContainerMenu}>
              <Text style={styles.RestaurantNameMenu}>{restaurantInfo.name}</Text>
              <Text style={styles.RestaurantSpecialityMenu}>
                {restaurantInfo.speciality}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.HmenuContainerMenu}>
          <ScrollView
            showsHorizontalScrollIndicator={false}
            horizontal={true}
            style={styles.HmenuMenu}
          >
            {['All', ...menuCategories.map(cat => cat.id)].map((menu) => (
              <TouchableOpacity
                key={menu}
                style={[
                  styles.HmenuBTNMenu,
                  {
                    borderBottomColor: activeMenu === menu ? '#FEC635' : 'white',
                    borderBottomWidth: activeMenu === menu ? 3 : 0,
                  },
                ]}
                onPress={() => handlePress(menu)}
              >
                <Text style={styles.HmenuBTNtxtMenu}>{menu}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.MenuContainerMenu}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.VmenuMenu}
        >
          {activeMenu === 'All'
      ? menuCategories.map((category) => (
          <MenuCategory 
            key={category.id} 
            title={category.id} 
            items={category.items} 
            categoryId={category.id} // Pass the correct categoryId to items
            visibleItems={visibleItems} // Pass state as prop
            toggleCountContainer={toggleCountContainer} 
            addItemToBasket={addItemToBasket}  // Pass addItemToBasket function
            removeItemFromBasket={removeItemFromBasket}
          />
        ))
      : menuCategories
          .filter((category) => category.id === activeMenu)
          .map((category) => (
            <MenuCategory 
              key={category.id} 
              title={category.id} 
              items={category.items} 
              categoryId={category.id} // Pass the correct categoryId
              visibleItems={visibleItems}
              toggleCountContainer={toggleCountContainer} 
              addItemToBasket={addItemToBasket}  // Pass addItemToBasket function
              removeItemFromBasket={removeItemFromBasket}
            />
          ))}
        </ScrollView>
      </View>
      {totalPrice > 0 && (
        <View style={styles.basketContainer}>
          
        <TouchableOpacity style={styles.bascket} onPress={() => setIsBasketModalOpen(true)}>
          <Image style={styles.basketIcon} source={require('../assets/shopping-basket.png')} />
          <Text style={styles.basketTxt}>View basket</Text>
          <Text style={styles.basketPrice}>{totalPrice} da</Text>
        </TouchableOpacity>
      </View>
      )}
    <Modal visible={isBasketModalOpen} transparent animationType="slide">
    <TouchableWithoutFeedback onPress={() => setIsBasketModalOpen(false)}>
        <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback>
        <View style={styles.FullBasket}>
          <View style={styles.basketHeader}>
      <Text style={styles.bascketTitle}>Basket</Text>
      <TouchableOpacity 
        style={styles.EmptyBasketBtn} 
        onPress={() => {
          // Set all item counts to 0
          const resetCategories = menuCategories.map((category) => ({
            ...category,
            items: category.items.map((item) => ({ ...item, count: 0 })),
          }));
          setMenuCategories(resetCategories);
          setTotalPrice(0);
          setIsBasketModalOpen(false);
        }}
      >
        <Text style={styles.EmptyBasketBtnTXT}>Empty basket</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.basketItemsContainer}>
      {menuCategories.flatMap((category) =>
        category.items
          .filter((item) => item.count > 0) // Only show items with count > 0
          .map((item, index) => (
            <View key={`${category.id}-${index}`} style={styles.basketItem}>
              <Text style={styles.basketItemName}>{item.itemName}</Text>
              <View style={styles.ItemPriceBasketWithBtns}>
                {/* Item Count and Price */}
                <Text style={styles.basketItemPriceNdCount}>
                  {item.count} x {item.price} DA
                </Text>
              </View>
            </View>
          ))
      )}
    </View>
          <View style={styles.basketComfirmContainer}>
          <TouchableOpacity
              style={styles.comfirmBtn}
             onPress={() => {
                const orderedItems = menuCategories.flatMap((category) =>
                  category.items.filter((item) => item.count > 0)
                );

                navigation.navigate('OrderDetails', {
                  restaurantName: restaurantInfo.name,
                  orderedItems, // Array of ordered items with count and price
                  restaurantLocation: restaurantInfo.location,
                  restaurantLogo: restaurantInfo.logo,
                  wilaya,
                  restaurantId,
                  totalPrice,
                });

                // Reset basket after confirming the order
                const resetCategories = menuCategories.map((category) => ({
                  ...category,
                  items: category.items.map((item) => ({ ...item, count: 0 })),
                }));
               setMenuCategories(resetCategories);
                setTotalPrice(0);
               setIsBasketModalOpen(false); // Close the basket
             }}
            >
              <Text style={styles.comfirmBtnTXT}>Confirm Order</Text>
            </TouchableOpacity>
            <View style={styles.TotalBasket}>
              <Text style={styles.TotalBasketTXT}>{totalPrice} da</Text>
            </View>
          </View>
        </View>
        </TouchableWithoutFeedback>
      </View>
      </TouchableWithoutFeedback>
    </Modal>
    </SafeAreaView>
  );
};

const MenuCategory = ({ title, items, categoryId, visibleItems, toggleCountContainer, addItemToBasket, removeItemFromBasket }) => (
  <View style={styles.MenuCategoryMenu}>
    <View style={styles.TitleMenuMenu}>
      <Text style={styles.menuTitleTXTMenu}>{title}</Text>
    </View>
    {items.map((item, index) => {
      const uniqueKey = `${categoryId}-${index}`; // Create a unique key for each item
      return (
        <View key={uniqueKey} style={styles.ItemContainer}>
          <TouchableOpacity
            style={styles.itemMenu}
            onPress={() => toggleCountContainer(categoryId, index)}
          >
            <View>
              <Text style={styles.ItemNameMenu}>{item.itemName}</Text>
              <Text style={styles.ItemIngredientsMenu}>{item.ingredients}</Text>
              <Text style={styles.PriceMenu}>{item.price} da</Text>
            </View>
            {visibleItems[uniqueKey] && item.count > 0 && ( // Show CountContainer only if the item's unique key matches
              <View style={styles.orderCount}>
                <TouchableOpacity
                  style={styles.Btn}
                  onPress={() => addItemToBasket(categoryId, index)}  // Use addItemToBasket here
                >
                  <View style={styles.PlusBtn}>
                    <Image style={styles.locationIcon} source={require('../assets/plus-5.png')} />
                  </View> 
                </TouchableOpacity>
                <View style={styles.CountContainer}>
                  <Text style={styles.CountResturants}>
                    {item.count || 0}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.Btn}
                  onPress={() => removeItemFromBasket(categoryId, index)}  // Use removeItemFromBasket here
                >
                  <View style={styles.MinusBtn}>
                    <Image style={styles.locationIcon} source={require('../assets/minus.png')} />
                  </View>                
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    })}
  </View>
);

export default RestaurantMenuScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  headerContainerMenu: {
    overflow: 'hidden',
    maxHeight: '35%',
  },
  coverMenu: {
    height: '100%',
    width: '100%',
  },
  SearchBarContainerMenu: {
    padding: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundButtonMenu: {
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
  roundButtonMenuLiked: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEC631',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  locationIconMenuLiked: {
    tintColor: '#FFF',
  },
  CardInfoMenu: {
    padding: 7,
    flexDirection: 'row',
    height: '17%',
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
  RestaurantDescriptionContainerMenu: {
    padding: 15,
  },
  RestaurantNameMenu: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  RestaurantSpecialityMenu: {
    color: 'grey',
    fontSize: 15,
  },
  HmenuContainerMenu: {
    padding: 7,
    marginTop: 3,
    backgroundColor:'white'
  },
  HmenuMenu: {
    flexDirection: 'row',
  },
  HmenuBTNMenu: {
    backgroundColor: 'white',
    marginLeft: 5,
  },
  HmenuBTNtxtMenu: {
    padding: 10,
    color: 'black',
  },
  MenuContainerMenu: {
    flex: 1,
    padding: 10,
  },
  MenuCategoryMenu: {
    padding: 20,
  },
  TitleMenuMenu: {
    marginBottom: 10,
  },
  menuTitleTXTMenu: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  VmenuMenu: {
    padding: 10,
    marginTop: -170,
  },
  itemMenu: {
    paddingVertical: 10,
    flexDirection: 'row',
  },
  ItemContainer: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderColor: '#D3D3D3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 10,
    paddingTop: 10,
  },
  orderCount: {
    ...(Platform.OS === 'ios' && {
      marginLeft: 150,
  }),
    ...(Platform.OS === 'android' && {
    marginLeft: 110
      }),
  },
  CountContainer: {
    borderRadius: 30,
    width: 30,
    height: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 7,
    marginTop: 6,
    marginBottom: 6,
    // iOS shadow styles
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC635',
      shadowOpacity: 0.6,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
  }),
    // Android elevation style
    ...(Platform.OS === 'android' && {
    elevation: 8, // Adjust elevation value as needed
      }),
  },
  CountResturants: {
    fontSize : 27,
    fontWeight: 'bold',
    color : '#FEC635'
  },
  Btn: {
    width: 60,
    height: 40
  },
  ItemNameMenu: {
    fontSize: 20,
  },
  ItemIngredientsMenu: {
    paddingTop: 10,
    color: 'grey',
    fontSize: 15,
  },
  PriceMenu: {
    paddingTop: 10,
    fontSize: 20,
    color: '#FEC635',
    fontWeight: 'bold',
    paddingBottom: 10,
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
  PlusBtn: {
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
  MinusBtn: {
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
  basketContainer: {
    alignItems: 'center'
  },
  bascket: {
    width: Dimensions.get('window').width * 0.90,
    flexDirection: 'row',
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'space-between',
    paddingLeft: 15,
    paddingRight: 15,
    alignItems: 'center',
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC635',
      shadowOpacity: 0.5,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 5,
      marginBottom: 10,
    }),
  },
  basketTxt: {
    fontSize: 15,
    marginLeft: 30,
  },
  basketPrice: {
    color: '#FEC635',
    fontWeight: 'bold',
    fontSize: 18
  },
  FullBasket: {
    width: Dimensions.get('window').width * 0.90,
    borderRadius: 25,
    backgroundColor: 'white',
    padding: 15,
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC635',
      shadowOpacity: 0.5,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 5,
      marginBottom: 10,
    }),
  },
  basketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  bascketTitle: {
    fontSize: 20,
    fontWeight: '500'
  },
  EmptyBasketBtn: {
    paddingTop: 6
  },
  EmptyBasketBtnTXT: {
    color: '#FEC635',
    fontWeight: '500'
  },
  basketItem: {
    flexDirection: 'row',
    paddingBottom: 20,
    justifyContent: 'space-between'
  },
  basketItemName: {
    fontSize: 17,
    paddingTop: 5,
  },
  ItemPriceBasketWithBtns: {
    flexDirection: 'row',
  },
  basketItemPriceNdCount: {
    fontSize: 17,
    paddingTop: 5,
    paddingHorizontal: 10
  },
  basketComfirmContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 10
  },
  comfirmBtn: {
    width: Dimensions.get('window').width * 0.60,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC635',
      shadowOpacity: 0.7,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 5,
      color: '#FEC635'
    }),
  },
  comfirmBtnTXT: {
    color: 'black',
    fontWeight: '500'
  },
  TotalBasketTXT: {
    color: 'black',
    fontWeight: '500'
  },
  TotalBasket: {
    width: Dimensions.get('window').width * 0.20,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'ios' && {
      shadowColor: '#FEC635',
      shadowOpacity: 0.7,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 5,
    }),
    ...(Platform.OS === 'android' && {
      elevation: 5,
    }),
  },
  modalOverlay: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    flex: 1
  },
});