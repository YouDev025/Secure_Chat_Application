# Secure_Chat_Application

## Environment setup

Copy the example files before running locally:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then replace the JWT secrets with long random values.

Never commit real `.env` files or database credentials. If a secret is exposed in GitHub, rotate or delete it in the provider first, then remove it from Git history before closing the GitHub secret scanning alert.
