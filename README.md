# node-js_pdf-signer
A simple (docker) server for cryptographically signing PDF files, callable via api (e.g. from iOS Shortcut).

## Features

- Cryptographic PDF signature (PKCS#7)
- Visible note of digital signature on every page with name, date and Code128 barcode (of the certificate's common name)
- Multilingual (German / English)
- Multiple note positions: bottom (horizontal)  / left (vertical) / hidden (no note)
- P12 certificate is fetched via URL (including private GitHub repos)
- Protected by API token

## Signed PDF examples

<a href="https://github.com/emsi76/node-js_pdf-signer/blob/main/PDF%20Demo_bottom_signed.pdf" >
<img height="140" alt="PDF Demo_bottom_signed" src="https://github.com/user-attachments/assets/1d5ec850-1d23-44ce-9f05-80aa0267c5ad" />
</a>&nbsp;
<a href="https://github.com/emsi76/node-js_pdf-signer/blob/main/PDF%20Demo_left_signed.pdf">
<img height="140" alt="PDF Demo_left_signed" src="https://github.com/user-attachments/assets/4dde87a7-c8fd-44ee-913d-71972b2a5dd4" />
</a>


## Requirements

- ZimaOS / Docker
- A P12 certificate accessible via URL
- iOS Shortcuts app
- `LibreBarcode128-Regular.ttf` in the app directory

## Setup

### 1. Create or get a certificate

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem \
  -out cert.pem -days 3650 -nodes \
  -subj "/CN=Your Name"

openssl pkcs12 -export -out certificate.p12 \
  -inkey key.pem -in cert.pem \
  -passout pass:yourPassword
```

The `certificate.p12` must be accessible via URL.

> [!TIP]
> As alternative you can get free s/mime certificate from Actalis: <a href="https://www.actalis.com/s-mime-certificates">Actalis s/mime certifice</a>

### 2. Place files on ZimaOS

```bash
mkdir -p /DATA/AppData/pdf-signer
# Copy all files from this repository into the directory
# Copy LibreBarcode128-Regular.ttf into the directory
```
> [!NOTE]
> LibreBarcode128-Regular.ttf is a Google Font used to draw the barcode. You can get it <a href="https://fonts.google.com/specimen/Libre+Barcode+128?preview.script=Latn">here</a>

### 3. Run npm install

All dependencies are defined in `package.json` — a single command is enough:

```bash
docker run --rm \
  -v /DATA/AppData/pdf-signer:/app \
  -w /app \
  node:20-alpine \
  npm install
```

### 4. Install as Custom App in ZimaOS

In the ZimaOS dashboard → App Store → Install a Custom App → paste `docker-compose.yml`.

- **Docker Image:** `node:20-alpine`
- Set **API_TOKEN** to a secure value

## iOS Shortcut

**URL:** `http://zimaos.local:3000/sign`

**Headers:**
| Key | Value |
|---|---|
| `x-api-token` | yourSecretToken |

**Form fields:**
| Field | Required | Description |
|---|---|---|
| `pdf` | ✅ | PDF file |
| `p12_url` | ✅ | URL to the P12 certificate |
| `p12_passphrase` | ✅ | Password for the certificate |
| `token` | ✅ | Authorization header for P12 URL (e.g. GitHub token) |
| `lang` | – | Language: `de` (default) or `en` |
| `pos` | – | Footer position: `bottom` (default), `left` or `no` |

## Footer Modes

| `pos` | Description |
|---|---|
| `bottom` | Footer at the bottom of every page |
| `left` | Footer on the left side, rotated 90° |
| `no` | No visible footer (cryptographic signature only) |

## Environment Variables (docker-compose.yml)

| Variable | Description |
|---|---|
| `API_TOKEN` | Required: access token for the server |

## Security Note

The server should only be accessible within your home network. For external access, set up HTTPS.

## Thanks

Thanks to <a href="https://claude.ai/"><img src="https://claude.ai/favicon.ico" height="16" /> claude ai</a> for successful co-working on this project.
