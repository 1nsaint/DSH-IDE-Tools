# TLS certs for the HTTPS sidecar

The `https` service mounts this folder read-only. Generate a self-signed cert once:

```bash
cd "$(dirname "$0")"
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout key.pem -out cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Replace SANs with your LAN IP / hostname if you open `https://192.168.x.x:3443` directly.
Do not commit real `*.pem` files.
