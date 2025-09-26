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
  Platform, StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebase'; // Adjust the path as necessary
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

const RestaurantMenuScreen = ({ route }) => {
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [activeMenu, setActiveMenu] = useState('All');
  const [restaurantInfo, setRestaurantInfo] = useState(null); // Restaurant Info
  const [menuCategories, setMenuCategories] = useState([]); // Menu categories

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
      const restaurantId = route.params?.restaurantId; // Pass restaurant ID from previous screen
  
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
      }
    };
  
    fetchData();
  }, [route.params]);

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
                onPress={() => navigation.navigate('AdminHome')}
              >
                <Image
                  style={styles.locationIconMenu}
                  source={require('../assets/back.png')}
                />
              </TouchableOpacity>
              <View style={styles.searchBarMenu}></View>
              <TouchableOpacity
                style={styles.roundButtonMenu}
              >
                <Image
                  style={styles.locationIconMenu}
                  source={require('../assets/edit.png')}
                />
              </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.RestaurantDescriptionContainerMenu}
              onPress={() => navigation.navigate('Menu')}
            >
              <Text style={styles.RestaurantNameMenu}>{restaurantInfo.name}</Text>
              <Text style={styles.RestaurantSpecialityMenu}>
                {restaurantInfo.speciality}
              </Text>
            </TouchableOpacity>
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
                <MenuCategory key={category.id} title={category.id} items={category.items} />
              ))
            : menuCategories
                .filter((category) => category.id === activeMenu)
                .map((category) => (
                  <MenuCategory key={category.id} title={category.id} items={category.items} />
                ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const MenuCategory = ({ title, items }) => (
  <View style={styles.MenuCategoryMenu}>
    <View style={styles.TitleMenuMenu}>
      <Text style={styles.menuTitleTXTMenu}>{title}</Text>
    </View>
    {items.map((item, index) => (
      <TouchableOpacity key={index} style={styles.itemMenu}>
        <Text style={styles.ItemNameMenu}>{item.itemName}</Text>
        <Text style={styles.ItemIngredientsMenu}>{item.ingredients}</Text>
        <Text style={styles.PriceMenu}>{item.price} da</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default RestaurantMenuScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    marginTop: -190,
  },
  itemMenu: {
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: '#D3D3D3',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
});