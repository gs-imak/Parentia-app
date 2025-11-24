# Parentia - AI Pipeline (Milestone 0)
Petit backend minimal pour tester le pipeline texte → IA → JSON → validation.

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

Le serveur démarre sur :
`http://localhost:3000`

## Test rapide

### Via PowerShell
```powershell
curl.exe -X POST http://localhost:3000/parse ^
  -H "Content-Type: application/json" ^
  -d "{\"text\": \"Ceci est un test\"}"
```

### Via CMD
```bash
curl -X POST http://localhost:3000/parse \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Ceci est un test\"}"
```

### Réponse attendue (mock)

```json
{
  "success": true,
  "data": {
    "summary": "Mock summary of: Ceci est un test...",
    "items": ["item1", "item2", "item3"],
    "category": "general"
  }
}
```

### Exemple d’erreur

```json
{
  "success": false,
  "error": "Missing or invalid \"text\" field"
}
```

## Mode Mock / Mode Réel

- **Mock (par défaut)** : renvoie des données statiques, aucun compte OpenAI nécessaire.
- **Mode réel** :
  - dupliquez `.env.example` → `.env`
  - ajoutez `OPENAI_API_KEY=your_key`
