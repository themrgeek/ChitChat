import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "./src/store";

// Screens
import TermsScreen from "./src/screens/TermsScreen";
import AuthScreen from "./src/screens/AuthScreen";
import MainScreen from "./src/screens/MainScreen";
import ChatScreen from "./src/screens/ChatScreen";
import CallScreen from "./src/screens/CallScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const { isAuthenticated, termsAccepted } = useAuthStore();

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: "#00ff00",
            background: "#0a0a0a",
            card: "#111111",
            text: "#00ff00",
            border: "#1a1a1a",
            notification: "#00ff00",
          },
        }}
      >
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: "#0a0a0a" },
          }}
        >
          {!termsAccepted ? (
            <Stack.Screen name="Terms" component={TermsScreen} />
          ) : !isAuthenticated ? (
            <Stack.Screen name="Auth" component={AuthScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen
                name="Call"
                component={CallScreen}
                options={{ presentation: "fullScreenModal" }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
