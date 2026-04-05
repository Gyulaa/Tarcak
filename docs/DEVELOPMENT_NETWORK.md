# Development when LAN or Expo tunnel fails (VPN, corporate Wi‑Fi, etc.)

## Why `npx expo start --tunnel` breaks

Expo’s **built-in tunnel** talks to **ngrok** on Expo’s side. Errors like:

`TypeError: Cannot read properties of undefined (reading 'body')`

usually mean the tunnel API did not return a usable response (rate limits, account/session limits, VPN/firewall interference, or an ngrok-side change). This is **not specific to your app code**.

Use one of the options below instead of relying on `--tunnel`.

---

## Important: `start:localhost` and the QR code

With **`npm run start:localhost`**, Metro listens on **this computer’s** loopback (`127.0.0.1`).

When you **scan the QR code with your phone**, Expo Go opens a URL whose host is still **`127.0.0.1`** — but on the **phone**, `127.0.0.1` means **the phone itself**, not your PC. So **the QR code will not work** unless something (almost always **`adb reverse` over USB**) forwards the phone’s port 8081 to your PC.

**Summary**

| Setup | QR code | What to do |
|--------|---------|------------|
| `start:localhost`, **no** USB / **no** `adb reverse` | Broken | Don’t use localhost; use **`start:lan`** (Option 2) or a **custom tunnel** (Option 3). |
| `start:localhost` **+** `adb reverse` + phone authorized in `adb devices` | Often still wrong in Expo Go | Use **Enter URL manually** in Expo Go: **`exp://127.0.0.1:8081`** (not the LAN QR). |
| `start:lan`, phone and PC on same Wi‑Fi | Usually works | Scan QR or open the printed `exp://…` link. |

---

## Option 1 — Android + USB (works well with a VPN on the PC)

### 1a. Fix `adb.exe: no devices/emulators found`

`adb reverse` only works when the phone (or an emulator) appears in `adb devices`.

1. On the phone: **Developer options** → enable **USB debugging**.
2. Use a **data** USB cable (some cables are charge-only).
3. Plug in the phone → accept the **“Allow USB debugging?”** RSA prompt.
4. Run:

   ```powershell
   adb devices
   ```

   You should see a line like `XXXXXXXX device`. If it says `unauthorized`, unlock the phone and accept the prompt. If the list is **empty**, try another cable/port, install **Google USB Driver** / OEM drivers, and set USB mode to **File transfer (MTP)** or **USB debugging** (varies by OEM).

### 1b. Forward Metro and open the app

When `adb devices` shows your phone:

```powershell
adb reverse tcp:8081 tcp:8081
npm run start:localhost
```

In **Expo Go**, do **not** rely on the QR code for this setup. Tap **Enter URL** (or equivalent) and open:

**`exp://127.0.0.1:8081`**

If you unplug the phone or change the USB connection, run `adb reverse` again.

---

## Option 2 — LAN mode (no USB; VPN split-tunnel helps)

If the PC and phone are on the **same Wi‑Fi** and the phone can reach your PC’s IPv4:

```powershell
npm run start:lan
```

On Windows, check your Wi‑Fi IPv4 with `ipconfig` (e.g. `192.168.x.x`). Allow **Node.js** / **Metro** through **Windows Firewall** for **private** networks if the phone cannot connect.

If a **VPN** sends all traffic through the tunnel, enable **split tunneling** / **allow local network** for your LAN, or pause the VPN while developing.

**Use the QR code or link Expo prints** — they should point at your LAN IP, not `127.0.0.1`.

---

## Option 3 — Your own tunnel (Cloudflare or ngrok) + `EXPO_PACKAGER_PROXY_URL`

1. Start Metro (LAN is fine), e.g.:

   ```powershell
   npm run start:lan
   ```

2. In a **second** terminal, expose port **8081**, e.g. with **Cloudflare Tunnel** (free):

   ```powershell
   cloudflared tunnel --url http://localhost:8081
   ```

   Copy the printed `https://….trycloudflare.com` URL (no trailing path).

3. Restart Metro with:

   ```powershell
   $env:EXPO_PACKAGER_PROXY_URL="https://YOUR-SUBDOMAIN.trycloudflare.com"
   npm run start:lan
   ```

   The QR code / URL should then use that host (reachable from the phone even with a difficult LAN/VPN).

Same idea with **your own ngrok** account (`ngrok http 8081`) and the HTTPS URL it prints.

---

## Quick reference

| Scenario | Suggestion |
|----------|------------|
| Scanned QR with `start:localhost`, no USB | **Expected to fail** — use **`start:lan`** or USB + **manual** `exp://127.0.0.1:8081` after `adb reverse`. |
| `adb reverse` → “no devices” | Fix **USB debugging**, cable, drivers, **`adb devices`**. |
| VPN on PC, no USB | **Option 3** (cloudflared/ngrok) or fix **LAN/split tunnel** for Option 2. |

---

## Rebuilding the app

You do **not** need a release/production build to fix dev connectivity. Builds matter for **SQLCipher**, store distribution, or native changes—not for replacing `expo start --tunnel`.
