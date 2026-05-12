import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'War.wargram.com',
  appName: 'Wargram',
  webDir: 'dist',
  bundledWebRuntime: false,
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
