# GeoTrust – Interface Administrateur Tenant

Interface web d'administration d'un tenant GeoTrust, construite avec **Next.js 15**, **React 18**, **TypeScript** et **Material UI**.

## Démarrage

Dans le dossier `Admin_tenant` :

```bash
npm install
npm run dev
```

Par défaut, l'application se lance sur `http://localhost:3000`.

## Configuration du backend

L'interface consomme l'API NestJS existante (`geo-backend`). Configurez l'URL du backend via la variable d'environnement :

```bash
NEXT_PUBLIC_GEO_BACKEND_URL="http://localhost:3001"
```

Adaptez le port / host à votre configuration.

## Prochaines étapes

- Brancher l'authentification `admin_tenant` (login, stockage du token, gardes de routes).
- Connecter les pages :
  - `/agences` : liste / création / édition des agences.
  - `/cafs` : gestion des CAFs.
  - `/clients` : recherche client + détails.
  - `/zones` : gestion des zones et rattachement des agences.
  - `/tickets` : suivi des tickets IT (module `support-tickets` du backend).

