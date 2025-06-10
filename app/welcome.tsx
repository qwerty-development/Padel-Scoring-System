import React, { useEffect, useRef, useState } from "react";
import { 
  View, 
  ScrollView, 
  Dimensions, 
  Animated, 
  ImageBackground, 
  StyleSheet 
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

// Get precise screen dimensions
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Feature content for the carousel
const FEATURES = [
  {
    id: 1,
    title: "Match Tracking",
    description: "Record scores, track performance stats, and analyze your game progression",
    icon: "tennisball",
    color: "#1a7ebd" // Primary blue
  },
  {
    id: 2,
    title: "Glicko Rating",
    description: "Advanced rating system that accurately reflects your skill level and improvement",
    icon: "stats-chart",
    color: "#10b981" // Green for growth
  },
  {
    id: 3,
    title: "Friend Network",
    description: "Connect with friends, challenge players, and build your padel community",
    icon: "people",
    color: "#3b82f6" // Blue for social
  },
  {
    id: 4,
    title: "Match History",
    description: "Comprehensive history of all your matches with detailed performance metrics",
    icon: "calendar",
    color: "#8b5cf6" // Purple for history
  },
];

export default function WelcomeScreen() {
  const { colorScheme } = useColorScheme();
  const scrollX = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const [currentPage, setCurrentPage] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(SCREEN_WIDTH);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const isDark = colorScheme === "dark";
  
  // App icon based on color scheme
  const appIcon = isDark
    ? require("@/assets/icon.png")
    : require("@/assets/icon-dark.png");
    
  // Background image based on color scheme
  const backgroundImage = isDark
    ? require("@/assets/padel-court-dark.jpeg")
    : require("@/assets/padel-court-light.jpeg");
    
  // Colors based on theme
  const gradientColors = isDark
    ? ["rgba(0,0,0,0.85)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.5)"]
    : ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.85)", "rgba(255,255,255,0.7)"];
    
  // Primary color
  const primaryColor = "#1a7ebd"; 

  // **FIX 1: Handle ScrollView layout and ensure proper initial positioning**
  const handleScrollViewLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    setScrollViewWidth(width);
    
    // **FIX 2: Ensure initial position is exactly 0 after layout**
    if (!isLayoutReady) {
      setIsLayoutReady(true);
      // Force scroll to position 0 with a small delay to ensure layout is complete
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: false });
        }
      }, 50);
    }
  };

  // **FIX 3: Enhanced scroll handling with proper width calculation**
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { 
      useNativeDriver: false,
      listener: (event) => {
        const position = event.nativeEvent.contentOffset.x;
        const page = Math.round(position / scrollViewWidth);
        if (page !== currentPage && page >= 0 && page < FEATURES.length) {
          setCurrentPage(page);
        }
      }
    }
  );

  // **FIX 4: Updated momentum scroll end handler with proper width**
  const handleMomentumScrollEnd = (event: any) => {
    const position = event.nativeEvent.contentOffset.x;
    const page = Math.round(position / scrollViewWidth);
    if (page !== currentPage && page >= 0 && page < FEATURES.length) {
      setCurrentPage(page);
    }
  };

  // Animation sequence on component mount
  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // **FIX 5: Updated feature item renderer with dynamic width**
  const renderFeatureItem = (item: any, index: number) => {
    const inputRange = [
      (index - 1) * scrollViewWidth,
      index * scrollViewWidth,
      (index + 1) * scrollViewWidth,
    ];
    
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: "clamp",
    });
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: "clamp",
    });

    return (
      <View 
        style={{
          width: scrollViewWidth, // **FIX 6: Use actual ScrollView width**
          alignItems: 'center',
          justifyContent: 'center',
        }}
        key={item.id}
      >
        <Animated.View 
          style={[
            styles.featureItem,
            { 
              opacity,
              transform: [{ scale }],
              width: scrollViewWidth * 0.85, // **FIX 7: Scale based on actual width**
            }
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon} size={32} color="white" />
          </View>
          <H2 style={styles.featureTitle}>{item.title}</H2>
          <Text style={styles.featureDescription}>
            {item.description}
          </Text>
        </Animated.View>
      </View>
    );
  };

  // **FIX 8: Updated pagination with dynamic width**
  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {FEATURES.map((_, index) => {
          const opacity = scrollX.interpolate({
            inputRange: [
              (index - 1) * scrollViewWidth,
              index * scrollViewWidth,
              (index + 1) * scrollViewWidth,
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });
          
          const scale = scrollX.interpolate({
            inputRange: [
              (index - 1) * scrollViewWidth,
              index * scrollViewWidth,
              (index + 1) * scrollViewWidth,
            ],
            outputRange: [1, 1.3, 1],
            extrapolate: "clamp",
          });

          const width = currentPage === index ? 20 : 8;

          return (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                { 
                  opacity,
                  transform: [{ scale }],
                  width,
                  backgroundColor: currentPage === index ? primaryColor : (isDark ? '#555' : '#ccc')
                }
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <ImageBackground 
      source={backgroundImage}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Logo and Header */}
          <View style={styles.headerSection}>
            <Animated.View
              style={{
                transform: [{ scale: logoScale }],
              }}
            >
              <Image source={appIcon} style={styles.appLogo} />
            </Animated.View>
            
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }}
            >
              <H1 style={styles.appTitle}>Padel System</H1>
              <Muted style={styles.appSubtitle}>
                Track matches, improve your rating, and connect with the padel community
              </Muted>
            </Animated.View>
          </View>

          {/* **FIX 9: Enhanced Feature Carousel with proper initialization** */}
          <Animated.View
            style={[
              styles.carouselContainer,
              {
                opacity: fadeAnim,
              }
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              onLayout={handleScrollViewLayout} // **FIX 10: Add layout handler**
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToInterval={scrollViewWidth} // **FIX 11: Use actual width**
              snapToAlignment="center"
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustContentInsets={false}
              contentOffset={{ x: 0, y: 0 }} // **FIX 12: Explicit initial position**
              bounces={false} // **FIX 13: Disable bouncing for more precise control**
            >
              {FEATURES.map((item, index) => renderFeatureItem(item, index))}
            </ScrollView>
            
            {renderPagination()}
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            style={[
              styles.buttonContainer,
              {
                opacity: buttonAnim,
                transform: [
                  {
                    translateY: buttonAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              }
            ]}
          >
            <Button
              size="lg"
              variant="default"
              style={styles.signUpButton}
              onPress={() => router.push("/sign-up")}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="person-add" size={20} color="#333" style={styles.buttonIcon} />
                <Text style={styles.signUpText}>Create Account</Text>
              </View>
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              style={styles.signInButton}
              onPress={() => router.push("/sign-in")}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="log-in" size={20} color={isDark ? primaryColor : "#333"} style={styles.buttonIcon} />
                <Text style={styles.signInText}>Sign In</Text>
              </View>
            </Button>
          </Animated.View>

          {/* Version text */}
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

// **FIX 14: Updated styles with removed fixed width for featureItem**
const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  appLogo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 16,
  },
  appTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 28,
  },
  appSubtitle: {
    textAlign: 'center',
    marginHorizontal: 24,
    fontSize: 16,
    lineHeight: 22,
  },
  carouselContainer: {
    flex: 1,
    marginBottom: 24,
  },
  featureItem: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    // **FIX 15: Removed fixed width - now set dynamically in render**
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 24,
  },
  featureDescription: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    height: 20,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  signUpButton: {
    marginBottom: 16,
    height: 64,
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  signInButton: {
    height: 64,
    borderRadius: 32,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  buttonIcon: {
    marginRight: 8,
  },
  signUpText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  signInText: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
});