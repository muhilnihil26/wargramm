import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'War.wargram.com',
  appName: 'Wargram',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};

export default config;
