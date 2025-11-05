import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.37bfc874b316493e839712d9ce806f26',
  appName: 'IBAN Scanner',
  webDir: 'dist',
  server: {
    url: 'https://37bfc874-b316-493e-8397-12d9ce806f26.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen'
    }
  }
};

export default config;
