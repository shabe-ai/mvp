# Shabe CRM - AI-Powered Conversational CRM

A modern, AI-powered CRM system that allows you to manage your customer relationships through natural language conversations.

## 🚀 Features

### Core CRM Objects
- **Contacts**: Manage leads and contacts with full contact information
- **Accounts**: Track companies and organizations
- **Activities**: Schedule and track emails, calls, meetings, and events
- **Deals**: Manage sales opportunities and pipelines
- **Logs**: Complete conversation history and audit trail

### AI-Powered Operations
- **Natural Language Processing**: Create, read, update, and delete records through chat
- **Dynamic Custom Fields**: Add custom fields to any object type on the fly
- **Smart Query Resolution**: Handle ambiguous requests with follow-up questions
- **Real-time Data Tables**: View data in formatted tables within the chat interface

### Team Features
- **Multi-team Support**: Create and manage multiple teams
- **Shared Workspaces**: Collaborate with team members
- **Role-based Access**: Owner and member permissions
- **Team-specific Data**: Isolated data per team

### Technical Features
- **Real-time Updates**: Live data synchronization
- **Scalable Architecture**: Built for growth
- **Type Safety**: Full TypeScript support
- **Modern UI**: Beautiful, responsive interface

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: Convex (real-time, type-safe)
- **Authentication**: Clerk
- **AI**: OpenAI GPT-4
- **Email**: Gmail API integration
- **Package Manager**: pnpm

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shabe-mvp
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   ```env
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   
   # Convex (auto-generated)
   NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
   CONVEX_DEPLOYMENT=local:your-deployment
   
   # Gmail Integration (optional)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. **Start the development servers**
   ```bash
   # Terminal 1: Start Convex
   npx convex dev
   
   # Terminal 2: Start Next.js
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 Quick Start

1. **Sign up/Login**: Use the authentication system to create your account
2. **Create a Team**: Your first team will be created automatically
3. **Start Chatting**: Use natural language to manage your CRM:

### Example Commands

**Create Records:**
```
"Create a new contact named John Smith from Acme Corp"
"Add a new account called Tech Solutions Inc"
"Create a deal for $50k with Acme Corp"
"Schedule a meeting with John tomorrow at 2pm"
```

**View Data:**
```
"Show me all contacts"
"Display all deals in negotiation stage"
"List activities for this week"
"Find contacts from Acme Corp"
```

**Update Records:**
```
"Update John Smith's email to john@acme.com"
"Change the deal stage to closed won"
"Mark the meeting as completed"
```

**Add Custom Fields:**
```
"Add a custom field 'Industry' to contacts"
"Create a dropdown field 'Priority' for deals"
"Add a number field 'Budget' to accounts"
```

## 🏗️ Architecture

### Database Schema

The CRM uses a comprehensive schema with the following main tables:

- **teams**: Team management and permissions
- **contacts**: People and leads
- **accounts**: Companies and organizations  
- **activities**: Emails, calls, meetings, events
- **deals**: Sales opportunities
- **logs**: Conversation history
- **customFieldDefinitions**: Dynamic field definitions

### Key Relationships

- Contacts can be associated with Accounts
- Activities can link to Contacts, Accounts, and Deals
- Deals can be associated with Contacts and Accounts
- All objects support custom fields
- Team-based data isolation

### AI Integration

The system uses OpenAI GPT-4 to:
- Parse natural language requests
- Determine appropriate database operations
- Handle ambiguous queries with follow-up questions
- Format responses as tables and structured data

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev                    # Start Next.js dev server
npx convex dev             # Start Convex dev server

# Building
pnpm build                 # Build for production
pnpm start                 # Start production server

# Code Quality
pnpm lint                  # Run ESLint
pnpm type-check           # Run TypeScript checks

# Database
pnpm convex codegen       # Generate Convex types
pnpm convex deploy        # Deploy to production
```

### Project Structure

```
shabe-mvp/
├── convex/               # Database schema and functions
│   ├── schema.ts        # Database schema
│   ├── crm.ts          # CRM operations
│   └── seed.ts         # Sample data
├── src/
│   ├── app/            # Next.js app router
│   │   ├── api/        # API routes
│   │   └── page.tsx    # Main page
│   ├── components/     # React components
│   └── lib/           # Utilities
└── public/            # Static assets
```

## 🚀 Deployment

### Prerequisites
- Vercel account (for hosting)
- Convex account (for database)
- Clerk account (for authentication)

### Deployment Steps

1. **Deploy to Vercel**
   ```bash
   pnpm build
   # Deploy via Vercel dashboard or CLI
   ```

2. **Deploy Convex**
   ```bash
   npx convex deploy
   ```

3. **Configure Environment Variables**
   - Set production environment variables in Vercel
   - Update Convex deployment URL

## 🔮 Roadmap

### Phase 2: Advanced Team Features
- [ ] Team invitations and member management
- [ ] Advanced permissions and roles
- [ ] Team-specific custom fields
- [ ] Cross-team data sharing

### Phase 3: Integrations & Automation
- [ ] API for external integrations
- [ ] Workflow automation
- [ ] Advanced reporting and analytics
- [ ] Email marketing integration

### Phase 4: Enterprise Features
- [ ] Advanced security and compliance
- [ ] Multi-tenant architecture
- [ ] Advanced analytics and AI insights
- [ ] Mobile app

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ using Next.js, Convex, and OpenAI**
# Force redeploy
# Updated for app.shabe.ai
