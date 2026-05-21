# Secrets folder

Bu klasör docker-compose tarafından her backend container'a `/run/secrets` olarak read-only mount edilir.

İçeride saklamalı:

- `firebase-sa.json` — Firebase Admin SDK service-account anahtarı

Klasörün kendisi git'e dahildir ama içindeki dosyalar **`.gitignore`** ile dışlanmıştır. Asla service-account JSON'unu commit etme.

## Bu dosyayı nasıl alırsın

1. <https://console.firebase.google.com/> → projeni aç → ⚙️ Project Settings
2. **Service accounts** sekmesi → "Generate new private key" → Generate key
3. İndirilen JSON dosyasını **bu klasöre** `firebase-sa.json` adıyla kaydet
