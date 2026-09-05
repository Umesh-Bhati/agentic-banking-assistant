# Mobile App

## Remote Testing Instructions (The "No-Build" Tunnel Method)

If you need to share this app with someone (like an iOS user) who is not on your local network, you can use the tunnel method to expose both your Expo dev server and your local backend. This allows them to test the app using Expo Go from anywhere in the world.

### 1. Tunnel your Backend (on your laptop)
You need to expose your local backend (`localhost:3000`) to the internet so the remote phone can reach it.
1. Open a new terminal on your laptop and run:
   ```bash
   npx ngrok http 3000
   ```
   *(If it asks you to sign up or authenticate with an ngrok authtoken, follow their instructions).*
2. Once running, it will give you a public "Forwarding" URL (e.g., `https://a1b2c3d4.ngrok-free.app`). Copy this URL.

### 2. Connect the Mobile App to the Tunnel
1. Inside the `apps/mobile` folder on your laptop, create a file named `.env`.
2. Add your ngrok URL to it like this:
   ```env
   EXPO_PUBLIC_API_URL=https://a1b2c3d4.ngrok-free.app
   ```
   *(Make sure there's no trailing slash at the end of the URL).*

### 3. Start Expo with a Tunnel (on your laptop)
Now we need to tunnel the Metro server so the mobile app itself can be loaded remotely.
1. In the `apps/mobile` folder, start Expo using the `--tunnel` flag and clear the cache so it picks up the `.env` file:
   ```bash
   pnpm exec expo start --tunnel -c
   ```
   *(This might prompt you to install `@expo/ngrok`. If it does, press `y` to accept).*

### 4. Test it on the remote device
1. Ask the tester to download **Expo Go** from the iOS App Store or Google Play Store.
2. Give the tester your **Expo account credentials** (email/password) and have them log in to the Expo Go app.
3. Because you started the server with `--tunnel`, your dev server will magically appear under their "Development servers" list in the app.
4. They just tap it, and the app will open and connect to your local backend through the tunnel!

> **Note:** Whenever you're done testing, you can stop the `ngrok` and `expo` commands in your terminal and delete the `.env` file to go back to local development.
