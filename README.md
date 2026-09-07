# Agentic Banking Assistant

**Agentic Banking Assistant** is a full-stack FinTech application designed to demonstrate the power of deeply integrated AI in secure environments. Unlike standard chatbots, this assistant uses agentic tool-calling to securely interact with a backend database on behalf of the authenticated user. It can seamlessly answer contextual questions, retrieve real-time account balances, fetch transaction histories, and dynamically generate authenticated PDF statements—all through a natural conversational interface.

---

## 🚀 Key Features

* **Agentic Tool-Calling:** The AI assistant uses the Mastra framework to securely invoke internal banking API tools based on conversational context.
* **Contextual Identity:** The bot is securely aware of the logged-in user's identity, preventing data leakage and ensuring personalized service.
* **Smart Transaction Viewing:** Users can query recent activity seamlessly through chat without navigating complex banking UIs.
* **Dynamic PDF Generation:** Need an official bank statement? The AI will verify the user's accounts, ensure they accept the service fee, and then dynamically generate and serve a secure PDF statement.
* **Card Management:** Provides secure flows to select and block compromised debit or credit cards.
* **Full-Stack Monorepo:** Structured using `pnpm` workspaces for clean separation between the backend (Fastify), frontend (Expo/React Native), and shared types.

---

## 🛠️ Tech Stack

### Backend
* **Server:** Node.js with [Fastify](https://fastify.dev/)
* **AI Agent Framework:** [Mastra](https://mastra.ai/) (powered by OpenRouter/OpenAI)
* **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + JWT Auth)
* **PDF Generation:** PDFKit

### Frontend
* **Mobile App:** [Expo](https://expo.dev/) & React Native
* **Navigation:** Expo Router
* **UI Components:** Lucide Icons, Assistant-UI

---

## 🏗️ Project Structure

This project uses a monorepo structure managed by `pnpm`.

```text
├── apps/
│   ├── backend/           # Fastify server, Mastra AI Agent, and API routes
│   └── mobile/            # Expo React Native mobile application
├── packages/
│   ├── shared-types/      # TypeScript definitions shared between backend/mobile
│   └── ...
├── supabase/
│   └── seed.sql           # Database schema and mock transaction data
```

---

## 🚦 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v22+)
* [pnpm](https://pnpm.io/)
* [Supabase CLI](https://supabase.com/docs/guides/cli) (if running the database locally)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Umesh-Bhati/agentic-banking-assistant.git
   cd agentic-banking-assistant
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Database Setup:**
   Ensure you have your Supabase environment running and seeded:
   ```bash
   supabase start
   # This will automatically run supabase/seed.sql to populate mock users (e.g. Umesh, Priyank)
   ```

4. **Environment Variables:**
   Create a `.env` file in the `apps/backend` directory based on the configuration (Supabase URLs, OpenAI/OpenRouter keys).

### Running the Project

**1. Start the Backend:**
```bash
cd apps/backend
pnpm dev
```
*The Fastify server will start on port 3000.*

**2. Start the Mobile App:**
```bash
cd apps/mobile
pnpm start
```
*Use the Expo Go app on your phone, or run an iOS/Android simulator to view the app.*

---

## 🛡️ Security & Privacy
This project showcases how to implement AI safely in a FinTech context:
- **No Hallucinated Data:** The agent uses tools mapped directly to authenticated backend SQL queries.
- **Strict Authorization:** Tools like `generateStatementTool` and the backend PDF generation routes strictly verify that `product.customer_id === request.customerId`. 
- **Prompt Guardrails:** The LLM system prompt is strictly instructed to refuse queries about third-party individuals, ensuring data privacy even if the user tries to trick the AI.

---

## 📝 License
This project is open-source and available under the [ISC License](LICENSE).
